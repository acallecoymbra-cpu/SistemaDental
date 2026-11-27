import type { AvailabilityInterval } from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/**
 * Pruebas de integración de los intervalos de atención (T-02, PostgreSQL real).
 * Cada prueba usa su propia fecha, para que no se estorben entre sí.
 * La regla «no dejar fuera una cita confirmada» se prueba en appointments-slots.int-spec.ts.
 */
describe('intervalos de atención (T-02, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;

  const BASE = '/api/v1/admin/availability-intervals';

  const admin = () => ({
    get: () => ctx.http().get(BASE).set('Cookie', cookie),
    post: (body: object) =>
      ctx.http().post(BASE).set('Origin', TEST_WEB_ORIGIN).set('Cookie', cookie).send(body),
    patch: (id: string, body: object) =>
      ctx
        .http()
        .patch(`${BASE}/${id}`)
        .set('Origin', TEST_WEB_ORIGIN)
        .set('Cookie', cookie)
        .send(body),
    delete: (id: string) =>
      ctx.http().delete(`${BASE}/${id}`).set('Origin', TEST_WEB_ORIGIN).set('Cookie', cookie),
  });

  /** Crea un intervalo y devuelve lo que responde la API. */
  async function create(serviceDate: string, startsLocal: string, endsLocal: string) {
    const res = await admin().post({ serviceDate, startsLocal, endsLocal }).expect(201);
    return res.body as AvailabilityInterval;
  }

  async function auditRows(id: string) {
    return ctx.db.query(
      `SELECT action, before_json, after_json FROM audit_log
       WHERE entity_type = 'availability_interval' AND entity_id = $1
       ORDER BY occurred_at`,
      [id],
    );
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
      const body = { serviceDate: '2030-01-10', startsLocal: '08:00', endsLocal: '12:00' };
      await ctx.http().get(BASE).expect(401);
      await ctx.http().post(BASE).set('Origin', TEST_WEB_ORIGIN).send(body).expect(401);
      await ctx.http().patch(`${BASE}/${id}`).set('Origin', TEST_WEB_ORIGIN).send({}).expect(401);
      await ctx.http().delete(`${BASE}/${id}`).set('Origin', TEST_WEB_ORIGIN).expect(401);
    });
  });

  describe('crear', () => {
    it('crea un intervalo, responde horas HH:mm y deja auditoría', async () => {
      const created = await create('2030-01-11', '08:00', '12:00');
      expect(created).toMatchObject({
        serviceDate: '2030-01-11',
        startsLocal: '08:00',
        endsLocal: '12:00',
      });
      expect(Object.keys(created).sort()).toEqual([
        'createdAt',
        'endsLocal',
        'id',
        'serviceDate',
        'startsLocal',
        'updatedAt',
      ]);

      const rows = await auditRows(created.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe('availability_interval_created');
      expect(rows[0].after_json).toMatchObject({
        serviceDate: '2030-01-11',
        startsLocal: '08:00',
        endsLocal: '12:00',
      });
    });

    it('acepta exactamente 45 minutos (el mínimo)', async () => {
      await create('2030-01-12', '08:00', '08:45');
    });

    it('valida el cuerpo (400)', async () => {
      const ok = { serviceDate: '2030-01-13', startsLocal: '08:00', endsLocal: '12:00' };
      // formato
      await admin()
        .post({ ...ok, serviceDate: '13/01/2030' })
        .expect(400);
      await admin()
        .post({ ...ok, startsLocal: '8:00' })
        .expect(400);
      await admin()
        .post({ ...ok, endsLocal: '24:00' })
        .expect(400);
      // campos que faltan y que sobran
      await admin().post({ serviceDate: '2030-01-13' }).expect(400);
      await admin()
        .post({ ...ok, nota: 'x' })
        .expect(400);
      // fecha con buen formato pero inexistente
      const res = await admin()
        .post({ ...ok, serviceDate: '2030-02-30' })
        .expect(400);
      expect(res.body.message).toBe('La fecha no es válida.');
    });

    it('rechaza fin igual o anterior al inicio (400)', async () => {
      const base = { serviceDate: '2030-01-14' };
      await admin()
        .post({ ...base, startsLocal: '10:00', endsLocal: '10:00' })
        .expect(400);
      const res = await admin()
        .post({ ...base, startsLocal: '12:00', endsLocal: '08:00' })
        .expect(400);
      expect(res.body.message).toBe('La hora de fin debe ser posterior a la hora de inicio.');
    });

    it('rechaza menos de 45 minutos (400)', async () => {
      const res = await admin()
        .post({ serviceDate: '2030-01-15', startsLocal: '08:00', endsLocal: '08:44' })
        .expect(400);
      expect(res.body.message).toBe('El intervalo debe durar al menos 45 minutos.');
    });
  });

  describe('superposición', () => {
    it('rechaza un intervalo que se superpone en la misma fecha (409)', async () => {
      await create('2030-02-01', '08:00', '12:00');
      const res = await admin()
        .post({ serviceDate: '2030-02-01', startsLocal: '11:00', endsLocal: '14:00' })
        .expect(409);
      expect(res.body.message).toBe(
        'Ya existe un intervalo de atención que se superpone con ese horario.',
      );
      // contenido por completo dentro del otro
      await admin()
        .post({ serviceDate: '2030-02-01', startsLocal: '09:00', endsLocal: '10:00' })
        .expect(409);
    });

    it('permite intervalos que solo se tocan en el borde', async () => {
      await create('2030-02-02', '08:00', '12:00');
      await create('2030-02-02', '12:00', '14:00');
    });

    it('permite el mismo horario en otra fecha', async () => {
      await create('2030-02-03', '08:00', '12:00');
      await create('2030-02-04', '08:00', '12:00');
    });

    it('la base también lo impide, sin pasar por la API', async () => {
      await create('2030-02-05', '08:00', '12:00');
      const [dentist] = await ctx.db.query('SELECT id FROM dentist_user WHERE active LIMIT 1');
      await expect(
        ctx.db.query(
          `INSERT INTO availability_interval (service_date, starts_local, ends_local, created_by)
           VALUES ('2030-02-05', '10:00', '13:00', $1)`,
          [dentist.id],
        ),
      ).rejects.toMatchObject({ driverError: { code: '23P01' } });
    });
  });

  describe('listar', () => {
    it('ordena por fecha y hora de inicio', async () => {
      await create('2030-03-02', '14:00', '16:00');
      await create('2030-03-01', '09:00', '10:00');
      await create('2030-03-02', '08:00', '12:00');

      const list = (await admin().get().expect(200)).body as AvailabilityInterval[];
      const march = list
        .filter((i) => i.serviceDate.startsWith('2030-03'))
        .map((i) => `${i.serviceDate} ${i.startsLocal}`);
      expect(march).toEqual(['2030-03-01 09:00', '2030-03-02 08:00', '2030-03-02 14:00']);
    });
  });

  describe('editar', () => {
    it('cambia el horario y guarda antes y después en la auditoría', async () => {
      const created = await create('2030-04-01', '08:00', '12:00');
      const res = await admin().patch(created.id, { endsLocal: '13:00' }).expect(200);
      expect(res.body).toMatchObject({ startsLocal: '08:00', endsLocal: '13:00' });

      const rows = await auditRows(created.id);
      expect(rows.map((r: { action: string }) => r.action)).toEqual([
        'availability_interval_created',
        'availability_interval_updated',
      ]);
      expect(rows[1].before_json.endsLocal).toBe('12:00');
      expect(rows[1].after_json.endsLocal).toBe('13:00');
    });

    it('puede mover el intervalo a otra fecha', async () => {
      const created = await create('2030-04-02', '08:00', '12:00');
      const res = await admin().patch(created.id, { serviceDate: '2030-04-03' }).expect(200);
      expect(res.body.serviceDate).toBe('2030-04-03');
    });

    it('si no cambia nada, no registra auditoría', async () => {
      const created = await create('2030-04-04', '08:00', '12:00');
      await admin().patch(created.id, { startsLocal: '08:00' }).expect(200);
      expect(await auditRows(created.id)).toHaveLength(1);
    });

    it('rechaza una edición que lo superpone con otro (409)', async () => {
      await create('2030-04-05', '08:00', '12:00');
      const second = await create('2030-04-05', '14:00', '18:00');
      await admin().patch(second.id, { startsLocal: '11:00' }).expect(409);
      // mover a una fecha ocupada también cuenta
      const other = await create('2030-04-06', '14:00', '18:00');
      await admin()
        .patch(other.id, { serviceDate: '2030-04-05', startsLocal: '09:00' })
        .expect(409);
    });

    it('valida el resultado final, no solo lo enviado (400)', async () => {
      const created = await create('2030-04-07', '08:00', '12:00');
      // solo se envía el fin, pero junto al inicio guardado dura 30 min
      await admin().patch(created.id, { endsLocal: '08:30' }).expect(400);
      // fin anterior al inicio guardado
      await admin().patch(created.id, { endsLocal: '07:00' }).expect(400);
      await admin().patch(created.id, { serviceDate: '2030-02-30' }).expect(400);
      // no quedó modificado
      const list = (await admin().get()).body as AvailabilityInterval[];
      expect(list.find((i) => i.id === created.id)).toMatchObject({ endsLocal: '12:00' });
    });

    it('un id inexistente da 404 y uno mal formado da 400', async () => {
      await admin()
        .patch('3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', { endsLocal: '12:00' })
        .expect(404);
      await admin().patch('no-es-un-uuid', { endsLocal: '12:00' }).expect(400);
    });
  });

  describe('eliminar', () => {
    it('elimina el intervalo (204) y deja cómo era en la auditoría', async () => {
      const created = await create('2030-05-01', '08:00', '12:00');
      await admin().delete(created.id).expect(204);

      const list = (await admin().get()).body as AvailabilityInterval[];
      expect(list.map((i) => i.id)).not.toContain(created.id);

      const rows = await auditRows(created.id);
      const last = rows[rows.length - 1];
      expect(last.action).toBe('availability_interval_deleted');
      expect(last.before_json).toMatchObject({
        serviceDate: '2030-05-01',
        startsLocal: '08:00',
        endsLocal: '12:00',
      });
    });

    it('al eliminarlo, el horario queda libre para crear otro', async () => {
      const created = await create('2030-05-02', '08:00', '12:00');
      await admin().delete(created.id).expect(204);
      await create('2030-05-02', '09:00', '11:00');
    });

    it('un id inexistente da 404 y uno mal formado da 400', async () => {
      await admin().delete('3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e').expect(404);
      await admin().delete('no-es-un-uuid').expect(400);
    });

    it('eliminar dos veces: la segunda da 404', async () => {
      const created = await create('2030-05-03', '08:00', '12:00');
      await admin().delete(created.id).expect(204);
      await admin().delete(created.id).expect(404);
    });
  });
});
