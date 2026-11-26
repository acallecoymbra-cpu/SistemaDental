// Pruebas de las reglas del chat (T-18): urgencia, sin diagnóstico, sin datos personales, respuesta por defecto.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUICK_REPLIES, normalizeText, reply } from '../src/features/chat/rules.ts';

const WA = 'https://wa.me/59170000000?text=Hola';
const ctx = {
  treatments: [
    { name: 'Limpieza', description: 'Limpieza dental profesional.' },
    { name: 'Exodoncia', description: null },
    { name: 'Prótesis fija', description: null },
  ],
  priceText: '30,00',
  depositText: '15,50',
  whatsappUrl: WA,
};
const noWa = { ...ctx, whatsappUrl: null };
const hasWa = (r) => r.links.some((l) => l.href === WA && l.external);

test('normaliza tildes, mayúsculas y signos', () => {
  assert.equal(normalizeText('  ¿Dónde   QUEDAN?  ').trim(), 'donde quedan');
});

test('urgencia: mensaje de emergencia + WhatsApp, sin diagnóstico', () => {
  for (const msg of [
    'Tengo una urgencia',
    'me sangra la encía y no para',
    'tengo la cara hinchada',
    'DOLOR FUERTE!!',
    'me caí y se me rompió un diente',
    'tengo fiebre y me duele la muela',
  ]) {
    const r = reply(msg, ctx);
    assert.equal(r.rule, 'urgencia', msg);
    assert.match(r.text, /emergencias/);
    assert.ok(hasWa(r), msg);
  }
});

test('la urgencia gana sobre otros temas', () => {
  assert.equal(reply('cuánto cuesta, tengo una emergencia', ctx).rule, 'urgencia');
});

test('urgencia sin WhatsApp configurado indica un centro de salud', () => {
  const r = reply('es una urgencia', noWa);
  assert.equal(r.rule, 'urgencia');
  assert.deepEqual(r.links, []);
  assert.match(r.text, /centro de salud/);
});

test('no diagnostica ni recomienda medicamentos', () => {
  for (const msg of [
    '¿Tengo caries?',
    'qué medicina me tomo',
    'puedo tomar ibuprofeno',
    'qué tengo en la muela',
    'me das una receta',
  ]) {
    const r = reply(msg, ctx);
    assert.equal(r.rule, 'diagnostico', msg);
    assert.match(r.text, /no puedo hacer diagnósticos/);
    assert.ok(!/ibuprofeno|paracetamol|mg\b/i.test(r.text));
  }
});

test('no pide datos personales y avisa si los escriben', () => {
  for (const msg of ['mi correo es ana@mail.com', 'mi número es 70000000', 'me llamo Ana']) {
    const r = reply(msg, ctx);
    assert.equal(r.rule, 'datos-personales', msg);
  }
  // ninguna respuesta pide nombre, carnet, celular o correo
  const all = [
    'hola',
    'horarios',
    'ubicación',
    'tratamientos',
    'precios',
    'reservar',
    'cancelar',
    'asdf',
    'urgencia',
    'tengo caries',
    'whatsapp',
  ];
  for (const msg of all) {
    assert.doesNotMatch(
      reply(msg, ctx).text,
      /(dime|escribe|env[ií]a|indica|compart(e|ir)|danos|dame) (tu|su) (nombre|carnet|celular|tel[eé]fono|correo|ci)\b/i,
      msg,
    );
  }
});

test('horarios, ubicación, tratamientos, precios y reserva', () => {
  assert.equal(reply('¿Cuál es el horario?', ctx).rule, 'horarios');
  assert.equal(reply('a qué hora atienden', ctx).rule, 'horarios');
  assert.equal(reply('¿Dónde quedan?', ctx).rule, 'ubicacion');
  assert.equal(reply('dirección', ctx).rule, 'ubicacion');
  const t = reply('¿Qué tratamientos tienen?', ctx);
  assert.equal(t.rule, 'tratamientos');
  assert.match(t.text, /Limpieza, Exodoncia, Prótesis fija/);
  const p = reply('¿Cuánto cuesta la consulta?', ctx);
  assert.equal(p.rule, 'precios');
  assert.match(p.text, /Bs 30,00/);
  assert.match(p.text, /Bs 15,50/);
  const r = reply('quiero agendar una cita', ctx);
  assert.equal(r.rule, 'reservar');
  assert.ok(r.links.some((l) => l.href === '/reservar'));
});

test('un tratamiento por su nombre devuelve su descripción', () => {
  const r = reply('hacen limpieza?', ctx);
  assert.equal(r.rule, 'tratamientos');
  assert.match(r.text, /Limpieza dental profesional/);
  assert.match(reply('hacen una exodoncia', ctx).text, /exodoncia/);
});

test('cancelar o reprogramar: por WhatsApp y el anticipo no se devuelve', () => {
  const r = reply('quiero cancelar mi cita', ctx);
  assert.equal(r.rule, 'cancelar');
  assert.match(r.text, /anticipo no se devuelve/);
  assert.ok(hasWa(r));
});

test('sin regla: respuesta por defecto con WhatsApp', () => {
  for (const msg of ['asdfgh', 'el cielo es azul', '', '   ']) {
    const r = reply(msg, ctx);
    assert.equal(r.rule, 'defecto', msg);
    assert.ok(hasWa(r));
  }
});

test('saludo', () => {
  assert.equal(reply('Hola, buenas tardes', ctx).rule, 'saludo');
});

test('si faltan datos de la clínica, no inventa: ofrece WhatsApp', () => {
  const partial = { treatments: [], priceText: null, depositText: null, whatsappUrl: WA };
  assert.match(reply('cuánto cuesta', partial).text, /No pude cargar los precios/);
  assert.match(reply('tratamientos', partial).text, /No pude cargar los tratamientos/);
});

test('no inventa la ubicación', () => {
  const r = reply('dónde están', ctx);
  assert.match(r.text, /WhatsApp/);
  assert.doesNotMatch(r.text, /calle|avenida|av\.|zona/i);
});

test('mensajes muy largos se recortan sin romperse', () => {
  assert.equal(reply('x'.repeat(100000), ctx).rule, 'defecto');
});

test('todos los atajos tienen respuesta propia (ninguno cae en la respuesta por defecto)', () => {
  for (const quick of QUICK_REPLIES) {
    assert.notEqual(reply(quick, ctx).rule, 'defecto', quick);
  }
});

test('nunca devuelve HTML ni enlaces a otros sitios que no sean WhatsApp o la reserva', () => {
  for (const msg of ['horarios', 'urgencia', 'precios', 'cancelar', 'asdf', 'tengo caries']) {
    for (const l of reply(msg, ctx).links) {
      assert.ok(l.href === '/reservar' || l.href.startsWith('https://wa.me/'));
    }
  }
});
