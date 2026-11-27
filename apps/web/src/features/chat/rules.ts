/**
 * Chat por reglas fijas (T-18, RF-10 a RF-12). SIN IA: cada respuesta sale de una regla
 * escrita aquí, por palabras clave. Sin diagnósticos, sin recomendar medicamentos y sin pedir
 * datos personales. Todo corre en el navegador: ningún mensaje se envía ni se guarda.
 *
 * Orden de prioridad: urgencia → pedido de diagnóstico → datos personales → temas del
 * consultorio → respuesta por defecto (siempre con WhatsApp).
 */

export interface ChatContext {
  /** Tratamientos activos del consultorio. */
  treatments: { name: string; description: string | null }[];
  /** Importes ya formateados, p. ej. `30,00`; null si no se pudieron cargar. */
  priceText: string | null;
  depositText: string | null;
  /** Enlace de WhatsApp ya armado, o null si el consultorio aún no lo configuró. */
  whatsappUrl: string | null;
}

export interface ChatLink {
  label: string;
  href: string;
  /** true si abre otra pestaña (WhatsApp). */
  external?: boolean;
}

export interface ChatReply {
  /** Regla que respondió (sirve para pruebas y para saber si fue la respuesta por defecto). */
  rule:
    | 'urgencia'
    | 'diagnostico'
    | 'datos-personales'
    | 'saludo'
    | 'horarios'
    | 'ubicacion'
    | 'tratamientos'
    | 'precios'
    | 'reservar'
    | 'cancelar'
    | 'contacto'
    | 'defecto';
  text: string;
  links: ChatLink[];
}

/** Atajos que se muestran como botones. */
export const QUICK_REPLIES = [
  'Horarios',
  'Ubicación',
  'Tratamientos',
  'Precios',
  'Reservar cita',
  'Tengo una urgencia',
] as const;

export const MAX_MESSAGE_LENGTH = 300;

/** Minúsculas, sin tildes ni signos, con espacios simples. */
export function normalizeText(text: string): string {
  return ` ${text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

/** true si el texto contiene alguna de las palabras (o frases) como palabra completa o prefijo. */
function has(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(` ${word}`));
}

const URGENCIA = [
  'urgencia',
  'urgente',
  'emergencia',
  'sangr',
  'hemorragia',
  'hinchaz',
  'hinchad',
  'inflam',
  'fiebre',
  'accidente',
  'golpe',
  'me cai',
  'se me rompio',
  'se me cayo',
  'se me quebro',
  'no puedo respirar',
  'no puedo abrir',
  'dolor fuerte',
  'mucho dolor',
  'dolor insoportable',
  'dolor intenso',
  'me duele mucho',
  'pus ',
  'infeccion',
  'desmay',
];
const DIAGNOSTICO = [
  'tengo caries',
  'que tengo',
  'que es esto',
  'es grave',
  'diagnost',
  'que medicina',
  'que medicamento',
  'que pastilla',
  'que me tomo',
  'que puedo tomar',
  'antibiotic',
  'ibuprofeno',
  'paracetamol',
  'analgesic',
  'receta',
  'dosis',
  'me recomiendas tomar',
  'es normal que',
  'sera cancer',
  'tengo cancer',
];
const DATOS = [
  '@',
  'mi carnet',
  'mi ci ',
  'mi cedula',
  'mi numero',
  'mi celular',
  'mi telefono',
  'mi correo',
  'mi email',
  'me llamo',
  'mi nombre es',
];

const SALUDO = [
  'hola',
  'buenas',
  'buen dia',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'saludos',
  'hey',
];
const HORARIOS = [
  'horario',
  'hora de atencion',
  'a que hora',
  'atienden',
  'atiende',
  'abren',
  'abierto',
  'cierran',
  'cuando atienden',
  'disponib',
  'dias de atencion',
  'turno',
];
const UBICACION = [
  'ubicacion',
  'ubicad',
  'donde',
  'direccion',
  'como llego',
  'como llegar',
  'mapa',
  'queda',
];
const TRATAMIENTOS = [
  'tratamiento',
  'servicio',
  'ofrecen',
  'hacen',
  'procedimiento',
  'que tratamientos',
];
const PRECIOS = [
  'precio',
  'cuesta',
  'costo',
  'cuanto',
  'tarifa',
  'anticipo',
  'pago',
  'pagar',
  'qr',
  'deposito',
];
const RESERVAR = [
  'reserv',
  'agendar',
  'agenda',
  'cita',
  'sacar hora',
  'turno',
  'quiero ir',
  'consulta',
];
const CANCELAR = [
  'cancel',
  'reprogram',
  'cambiar mi cita',
  'cambiar la cita',
  'mover mi cita',
  'no puedo ir',
  'no podre ir',
  'devolucion',
  'devuelven',
];
const CONTACTO = [
  'whatsapp',
  'wasap',
  'contacto',
  'contactar',
  'comunicar',
  'llamar',
  'hablar con',
  'escribir',
];

function whatsappLinks(ctx: ChatContext, label = 'Escribir por WhatsApp'): ChatLink[] {
  return ctx.whatsappUrl ? [{ label, href: ctx.whatsappUrl, external: true }] : [];
}

const BOOK_LINK: ChatLink = { label: 'Reservar cita', href: '/reservar' };

/** Elige la respuesta para el mensaje de la persona. Nunca falla: siempre hay una respuesta. */
export function reply(message: string, ctx: ChatContext): ChatReply {
  const text = normalizeText(message.slice(0, MAX_MESSAGE_LENGTH));
  const whatsapp = (label?: string) => whatsappLinks(ctx, label);
  const writeUs = ctx.whatsappUrl ? ' Escríbenos por WhatsApp.' : '';

  if (has(text, URGENCIA)) {
    return {
      rule: 'urgencia',
      text:
        'Lamento que estés pasando por esto. Si tienes dificultad para respirar, un sangrado que no se detiene, una hinchazón que avanza hacia el rostro o cuello, o un golpe fuerte, acude de inmediato a un servicio de emergencias. ' +
        'Para una urgencia dental, escríbenos ahora por WhatsApp y te responderemos lo antes posible.' +
        (ctx.whatsappUrl
          ? ''
          : ' (El consultorio aún no publicó su WhatsApp: acude a un centro de salud cercano.)'),
      links: whatsapp('Escribir ahora por WhatsApp'),
    };
  }

  if (has(text, DIAGNOSTICO)) {
    return {
      rule: 'diagnostico',
      text: 'Por aquí no puedo hacer diagnósticos ni recomendar medicamentos: eso lo evalúa la doctora en consulta, mirando tu caso. Si quieres, reserva una cita o escríbenos.',
      links: [BOOK_LINK, ...whatsapp()],
    };
  }

  if (has(text, DATOS)) {
    return {
      rule: 'datos-personales',
      text: 'Por tu seguridad, no compartas datos personales en este chat: no los necesito ni los guardo. Tus datos se piden solo al reservar tu cita, en el formulario.',
      links: [BOOK_LINK],
    };
  }

  if (has(text, CANCELAR)) {
    return {
      rule: 'cancelar',
      text:
        'Para cancelar o cambiar una cita, escríbenos por WhatsApp. Ten en cuenta que el anticipo no se devuelve.' +
        (ctx.whatsappUrl ? '' : ' Por ahora el consultorio no publicó su WhatsApp.'),
      links: whatsapp(),
    };
  }

  if (has(text, PRECIOS)) {
    if (ctx.priceText && ctx.depositText) {
      return {
        rule: 'precios',
        text: `La consulta cuesta Bs ${ctx.priceText}. Para reservar se paga un anticipo único de Bs ${ctx.depositText}, que se confirma al verificar tu comprobante. Cada consulta dura 45 minutos.`,
        links: [BOOK_LINK],
      };
    }
    return {
      rule: 'precios',
      text: `No pude cargar los precios en este momento.${writeUs}`,
      links: whatsapp(),
    };
  }

  const matchedTreatment = ctx.treatments.find((t) => {
    const name = normalizeText(t.name).trim();
    return name.length > 3 && text.includes(` ${name}`);
  });
  if (matchedTreatment) {
    return {
      rule: 'tratamientos',
      text: matchedTreatment.description
        ? `${matchedTreatment.name}: ${matchedTreatment.description} La doctora te explicará el procedimiento en la consulta.`
        : `Sí, realizamos ${matchedTreatment.name.toLowerCase()}. La doctora te explicará el procedimiento en la consulta.`,
      links: [BOOK_LINK],
    };
  }

  if (has(text, TRATAMIENTOS)) {
    if (ctx.treatments.length === 0) {
      return {
        rule: 'tratamientos',
        text: `No pude cargar los tratamientos en este momento.${writeUs}`,
        links: whatsapp(),
      };
    }
    return {
      rule: 'tratamientos',
      text: `Estos son los tratamientos del consultorio: ${ctx.treatments.map((t) => t.name).join(', ')}.`,
      links: [BOOK_LINK],
    };
  }

  if (has(text, HORARIOS)) {
    return {
      rule: 'horarios',
      text: 'Atendemos en los días y horarios que la doctora publica. Al reservar eliges una fecha y ves los horarios libres, en franjas de 45 minutos, desde mañana.',
      links: [BOOK_LINK, ...whatsapp('Consultar por WhatsApp')],
    };
  }

  if (has(text, UBICACION)) {
    return {
      rule: 'ubicacion',
      text:
        'Para la dirección exacta y cómo llegar, escríbenos por WhatsApp y te enviamos la ubicación.' +
        (ctx.whatsappUrl ? '' : ' Por ahora el consultorio no publicó su WhatsApp.'),
      links: whatsapp('Pedir la ubicación'),
    };
  }

  if (has(text, RESERVAR)) {
    return {
      rule: 'reservar',
      text: 'Puedes reservar en línea: eliges tratamiento, fecha y horario, y pagas un anticipo para confirmar. Tu horario queda apartado 8 minutos mientras pagas.',
      links: [BOOK_LINK],
    };
  }

  if (has(text, CONTACTO)) {
    return {
      rule: 'contacto',
      text: ctx.whatsappUrl
        ? 'Puedes escribirnos por WhatsApp; te respondemos lo antes posible.'
        : 'Por ahora el consultorio no publicó su WhatsApp. Puedes reservar tu cita en línea.',
      links: ctx.whatsappUrl ? whatsapp() : [BOOK_LINK],
    };
  }

  if (has(text, SALUDO)) {
    return {
      rule: 'saludo',
      text: '¡Hola! Soy el asistente automático de Renovando Sonrisas. Puedo ayudarte con horarios, ubicación, tratamientos, precios y reservas. No hago diagnósticos.',
      links: [],
    };
  }

  return {
    rule: 'defecto',
    text:
      'No tengo una respuesta para eso. Puedes elegir uno de los atajos o escribirnos por WhatsApp para que te atienda una persona.' +
      (ctx.whatsappUrl ? '' : ' Por ahora el consultorio no publicó su WhatsApp.'),
    links: whatsapp(),
  };
}

/** Mensaje de bienvenida del chat. */
export const WELCOME =
  'Hola, soy el asistente automático de Renovando Sonrisas. Elige un atajo o escribe tu pregunta. No hago diagnósticos ni pido datos personales.';
