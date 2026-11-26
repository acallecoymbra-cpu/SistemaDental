import {
  SHARED_PHONE_WARNING,
  todayInClinicTimeZone,
  type AdminPatient,
  type PatientWriteResponse,
} from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/**
 * Pruebas de integración de pacientes (T-05, PostgreSQL real). Todos los datos son inventados.
 * Cada prueba usa nombres y celulares propios para no estorbarse.
 */
describe('pacientes (T-05, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;

  const BASE = '/api/v1/admin/patients';

  const admin = () => ({
    get: (path = '') => ctx.http().get(`${BASE}${path}`).set('Cookie', cookie),
    post: (body: object) =>
      ctx.http().post(BASE).set('Origin', TEST_WEB_ORIGIN).set('Cookie', cookie).send(body),
    patch: (id: string, body: object) =>
      ctx
        .http()
        .patch(`${BASE}/${id}`)
        .set('Origin', TEST_WEB_ORIGIN)
        .set('Cookie', cookie)
        .send(body),
  });

  async function create(body: object): Promise<PatientWriteResponse> {
    return (await admin().post(body).expect(201)).body as PatientWriteResponse;
  }

  /** Fecha `AAAA-MM-DD` de hace `years` años (para fijar edad sin depender del día de hoy). */
  function yearsAgo(years: number, daysEarlier = 0): string {
    const [y, m, d] = todayInClinicTimeZone().split('-').map(Number);
    const date = new Date(Date.UTC(y! - years, m! - 1, d! - daysEarlier));
    return date.toISOString().slice(0, 10);
  }

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('sin sesión', () => {
    it('todas las rutas responden 401', async () => {
      const id = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
      await ctx.http().get(BASE).expect(401);
      await ctx.http().get(`${BASE}/${id}`).expect(401);
      await ctx
        .http()
        .post(BASE)
        .set('Origin', TEST_WEB_ORIGIN)
        .send({ fullName: 'X', phone: '70000001' })
        .expect(401);
      await ctx.http().patch(`${BASE}/${id}`).set('Origin', TEST_WEB_ORIGIN).send({}).expect(401);
    });

    it('no existe DELETE (los pacientes no se borran)', async () => {
      const { patient } = await create({ fullName: 'Prueba Borrado', phone: '70010001' });
      await ctx
        .http()
        .delete(`${BASE}/${patient.id}`)
        .set('Origin', TEST_WEB_ORIGIN)
        .set('Cookie', cookie)
        .expect(404);
    });
  });

  describe('crear', () => {
    it('crea un paciente, normaliza el celular y audita sin guardar datos de contacto', async () => {
      const res = await create({
        fullName: '  Ana  Pérez ',
        phone: '+591 7001-0002',
        email: 'ana@ejemplo.test',
        birthDate: '1990-03-10',
      });
      expect(res.warnings).toEqual([]);
      expect(res.patient).toMatchObject({
        fullName: 'Ana  Pérez',
        phone: '70010002',
        email: 'ana@ejemplo.test',
        birthDate: '1990-03-10',
        isMinor: false,
        guardianPhone: null,
        origin: 'dentist',
      });

      const [row] = await ctx.db.query(
        `SELECT action, after_json FROM audit_log WHERE entity_type = 'patient' AND entity_id = $1`,
        [res.patient.id],
      );
      expect(row.action).toBe('patient_created');
      expect(JSON.stringify(row.after_json)).not.toMatch(/70010002|ana@ejemplo/);
    });

    it('solo nombre y celular son obligatorios', async () => {
      const { patient } = await create({ fullName: 'Solo Nombre', phone: '70020001' });
      expect(patient).toMatchObject({ email: null, birthDate: null, isMinor: false });
    });

    it('valida el cuerpo (400)', async () => {
      const ok = { fullName: 'Valido Prueba', phone: '70030001' };
      await admin()
        .post({ ...ok, fullName: '   ' })
        .expect(400);
      await admin()
        .post({ ...ok, phone: '' })
        .expect(400);
      await admin()
        .post({ ...ok, email: 'no-es-correo' })
        .expect(400);
      await admin()
        .post({ ...ok, birthDate: '10/03/1990' })
        .expect(400);
      await admin()
        .post({ ...ok, extra: 1 })
        .expect(400);
      await admin().post({ fullName: 'Sin Celular' }).expect(400);
    });

    it('rechaza un celular que no tiene entre 7 y 15 dígitos (400)', async () => {
      const res = await admin().post({ fullName: 'Celular Malo', phone: 'abc' }).expect(400);
      expect(res.body.message).toBe('El celular debe tener entre 7 y 15 dígitos.');
      await admin().post({ fullName: 'Celular Corto', phone: '12345' }).expect(400);
    });
  });

  describe('duplicados', () => {
    it('el mismo nombre normalizado y celular no se duplica (409)', async () => {
      await create({ fullName: 'José Duplicado', phone: '70040001' });
      // sin tildes, en mayúsculas, con espacios de más y el celular con código de país
      const res = await admin()
        .post({ fullName: '  JOSE   DUPLICADO ', phone: '+591 70040001' })
        .expect(409);
      expect(res.body.message).toBe('Ya existe un paciente con ese nombre y celular.');
    });

    it('el mismo celular con otro nombre crea otro paciente y avisa', async () => {
      const first = await create({ fullName: 'Madre Compartida', phone: '70050001' });
      expect(first.warnings).toEqual([]);
      const second = await create({ fullName: 'Hijo Compartido', phone: '70050001' });
      expect(second.warnings).toEqual([SHARED_PHONE_WARNING]);
      expect(second.patient.id).not.toBe(first.patient.id);
    });

    it('la base también impide el duplicado, sin pasar por la API', async () => {
      await create({ fullName: 'Base Duplicado', phone: '70060001' });
      await expect(
        ctx.db.query(
          `INSERT INTO patient (full_name, normalized_name, phone, origin)
           VALUES ('Base Duplicado', 'base duplicado', '70060001', 'dentist')`,
        ),
      ).rejects.toMatchObject({ driverError: { code: '23505' } });
    });
  });

  describe('menores de edad', () => {
    it('un menor exige el celular del apoderado y queda con la etiqueta (V-18)', async () => {
      const birthDate = yearsAgo(10);
      const res = await admin()
        .post({ fullName: 'Menor Sin Apoderado', phone: '70070001', birthDate })
        .expect(400);
      expect(res.body.message).toBe(
        'Un paciente menor de edad necesita el celular de su apoderado.',
      );

      const { patient } = await create({
        fullName: 'Menor Con Apoderado',
        phone: '70070002',
        birthDate,
        guardianPhone: '+591 7007-0003',
      });
      expect(patient).toMatchObject({ isMinor: true, guardianPhone: '70070003' });
    });

    it('17 años y 364 días es menor; cumplir 18 deja de serlo', async () => {
      const almost = await create({
        fullName: 'Casi Mayor',
        phone: '70080001',
        birthDate: yearsAgo(18, -1),
        guardianPhone: '70080099',
      });
      expect(almost.patient.isMinor).toBe(true);

      const adult = await create({
        fullName: 'Ya Mayor',
        phone: '70080002',
        birthDate: yearsAgo(18),
      });
      expect(adult.patient.isMinor).toBe(false);
    });

    it('al editar la fecha de nacimiento se recalcula la etiqueta', async () => {
      const { patient } = await create({
        fullName: 'Cambia Etiqueta',
        phone: '70090001',
        birthDate: yearsAgo(10),
        guardianPhone: '70090099',
      });
      expect(patient.isMinor).toBe(true);
      const res = await admin()
        .patch(patient.id, { birthDate: yearsAgo(30) })
        .expect(200);
      expect((res.body as PatientWriteResponse).patient.isMinor).toBe(false);
    });

    it('no se puede quitar el apoderado a un menor (400)', async () => {
      const { patient } = await create({
        fullName: 'Menor Protegido',
        phone: '70100001',
        birthDate: yearsAgo(8),
        guardianPhone: '70100099',
      });
      await admin().patch(patient.id, { guardianPhone: null }).expect(400);
    });

    it('rechaza fechas de nacimiento futuras o inexistentes (400)', async () => {
      const base = { fullName: 'Fecha Mala', phone: '70110001' };
      await admin()
        .post({ ...base, birthDate: '2999-01-01' })
        .expect(400);
      await admin()
        .post({ ...base, birthDate: '2020-02-30' })
        .expect(400);
      await admin()
        .post({ ...base, birthDate: '1800-01-01' })
        .expect(400);
    });
  });

  describe('buscar', () => {
    beforeAll(async () => {
      await create({ fullName: 'Búsqueda Gómez', phone: '70120001' });
      await create({ fullName: 'Busqueda Rojas', phone: '70120002' });
      await create({
        fullName: 'Niña Apoderada',
        phone: '70120003',
        birthDate: yearsAgo(5),
        guardianPhone: '70120777',
      });
    });

    it('busca por nombre sin importar tildes ni mayúsculas', async () => {
      const res = await admin().get('?q=BUSQUEDA').expect(200);
      const names = (res.body as AdminPatient[]).map((p) => p.fullName);
      expect(names).toEqual(expect.arrayContaining(['Búsqueda Gómez', 'Busqueda Rojas']));
    });

    it('busca por celular, también con formato distinto', async () => {
      const res = await admin()
        .get(`?q=${encodeURIComponent('+591 7012-0001')}`)
        .expect(200);
      expect((res.body as AdminPatient[]).map((p) => p.fullName)).toEqual(['Búsqueda Gómez']);
    });

    it('también encuentra al menor por el celular de su apoderado', async () => {
      const res = await admin().get('?q=70120777').expect(200);
      expect((res.body as AdminPatient[]).map((p) => p.fullName)).toContain('Niña Apoderada');
    });

    it('sin resultados devuelve una lista vacía', async () => {
      const res = await admin().get('?q=zzzzzz-no-existe').expect(200);
      expect(res.body).toEqual([]);
    });

    it('un texto con símbolos de SQL no rompe ni devuelve todo', async () => {
      const res = await admin()
        .get(`?q=${encodeURIComponent("%_' OR 1=1 --")}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('sin texto devuelve los más recientes', async () => {
      const res = await admin().get('').expect(200);
      expect((res.body as AdminPatient[]).length).toBeGreaterThan(0);
    });
  });

  describe('ver y editar', () => {
    it('muestra un paciente por id; inexistente da 404 y mal formado 400', async () => {
      const { patient } = await create({ fullName: 'Ver Paciente', phone: '70130001' });
      const res = await admin().get(`/${patient.id}`).expect(200);
      expect(res.body).toMatchObject({ id: patient.id, fullName: 'Ver Paciente' });
      await admin().get('/3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e').expect(404);
      await admin().get('/no-es-un-uuid').expect(400);
    });

    it('edita y guarda en la auditoría solo los campos que cambiaron', async () => {
      const { patient } = await create({
        fullName: 'Edita Campos',
        phone: '70140001',
        email: 'antes@ejemplo.test',
      });
      const res = await admin().patch(patient.id, { email: 'despues@ejemplo.test' }).expect(200);
      expect((res.body as PatientWriteResponse).patient.email).toBe('despues@ejemplo.test');

      const rows = await ctx.db.query(
        `SELECT action, before_json, after_json FROM audit_log
         WHERE entity_type = 'patient' AND entity_id = $1 ORDER BY occurred_at`,
        [patient.id],
      );
      expect(rows.map((r: { action: string }) => r.action)).toEqual([
        'patient_created',
        'patient_updated',
      ]);
      expect(rows[1].before_json).toEqual({ email: 'antes@ejemplo.test' });
      expect(rows[1].after_json).toEqual({ email: 'despues@ejemplo.test' });
    });

    it('un cambio vacío no registra auditoría', async () => {
      const { patient } = await create({ fullName: 'Sin Cambios', phone: '70150001' });
      await admin().patch(patient.id, {}).expect(200);
      await admin().patch(patient.id, { fullName: 'Sin Cambios' }).expect(200);
      const rows = await ctx.db.query(
        `SELECT 1 FROM audit_log WHERE entity_type = 'patient' AND entity_id = $1`,
        [patient.id],
      );
      expect(rows).toHaveLength(1);
    });

    it('editar a un nombre y celular ya existentes da 409', async () => {
      await create({ fullName: 'Ya Existe Uno', phone: '70160001' });
      const { patient } = await create({ fullName: 'Ya Existe Dos', phone: '70160001' });
      await admin().patch(patient.id, { fullName: 'ya existe uno' }).expect(409);
    });

    it('editar el celular a uno compartido avisa', async () => {
      await create({ fullName: 'Comparte Origen', phone: '70170001' });
      const { patient } = await create({ fullName: 'Comparte Destino', phone: '70170002' });
      const res = await admin().patch(patient.id, { phone: '70170001' }).expect(200);
      expect((res.body as PatientWriteResponse).warnings).toEqual([SHARED_PHONE_WARNING]);
    });

    it('un id inexistente da 404', async () => {
      await admin().patch('3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', { fullName: 'X' }).expect(404);
    });
  });
});
