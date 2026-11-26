import { todayInClinicTimeZone } from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/** Reprogramar y «no asistió» (T-12) con PostgreSQL real. Datos inventados. */
describe('reprogramar y no asistió (T-12, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let treatmentId: string;
  let patientId: string;

  /** Día de prueba `n` días en el futuro, con atención 08:00–12:00 (5 franjas de 45 min). */
  function day(n: number): string {
    const [y, m, d] = todayInClinicTimeZone().split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
  }
  /** Instante UTC de una hora local de La Paz (UTC-4). */
  const at = (date: string, hhmm: string) =>
    new Date(Date.parse(`${date}T${hhmm}:00.000Z`) + 4 * 3_600_000).toISOString();

  const post = (id: string, action: string, body: object = {}, withCookie = true) => {
    const req = ctx
      .http()
      .post(`/api/v1/admin/appointments/${id}/${action}`)
      .set('Origin', TEST_WEB_ORIGIN);
    return (withCookie ? req.set('Cookie', cookie) : req).send(body);
  };
  const reschedule = (id: string, startsAt: unknown, withCookie = true) =>
    post(id, 'reschedule', { startsAt }, withCookie);

  async function interval(date: string, from = '08:00', to = '12:00') {
    await ctx
      .http()
      .post('/api/v1/admin/availability-intervals')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ serviceDate: date, startsLocal: from, endsLocal: to })
      .expect(201);
  }

  async function appointment(
    startsAt: string,
    status = 'confirmada',
    holdMinutes: number | null = null,
  ): Promise<string> {
    const [row] = await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin, hold_expires_at)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + interval '45 minutes', $4, 1000, 'web',
               CASE WHEN $5::int IS NULL THEN NULL ELSE now() + make_interval(mins => $5::int) END)
       RETURNING id`,
      [patientId, treatmentId, startsAt, status, holdMinutes],
    );
    return row.id;
  }

  const row = async (id: string) =>
    (await ctx.db.query('SELECT * FROM appointment WHERE id = $1', [id]))[0];

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
    const [t] = await ctx.db.query('SELECT id FROM treatment WHERE active = true LIMIT 1');
    treatmentId = t.id;
    const [p] = await ctx.db.query(
      `INSERT INTO patient (full_name, normalized_name, phone, origin)
       VALUES ('Paciente Mueve', 'paciente mueve', '75700001', 'web') RETURNING id`,
    );
    patientId = p.id;
    for (let n = 5; n <= 12; n += 1) await interval(day(n));
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('reprogramar', () => {
    it('sin sesión 401; identificador inválido 400; inexistente 404; fecha inválida 400', async () => {
      const id = await appointment(at(day(5), '08:00'));
      await reschedule(id, at(day(5), '08:45'), false).expect(401);
      await reschedule('no-es-uuid', at(day(5), '08:45')).expect(400);
      await reschedule('3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b', at(day(5), '08:45')).expect(404);
      for (const bad of ['', 'mañana', 123, null]) {
        await reschedule(id, bad).expect(400);
      }
      expect((await row(id)).starts_at.toISOString()).toBe(at(day(5), '08:00'));
    });

    it('mueve una confirmada a una franja libre y guarda el antes y el después', async () => {
      const id = await appointment(at(day(6), '08:00'));
      const target = at(day(7), '09:30');
      const res = await reschedule(id, target).expect(200);
      expect(res.body).toMatchObject({
        id,
        status: 'confirmada',
        startsAt: target,
        endsAt: at(day(7), '10:15'),
      });
      const saved = await row(id);
      expect(saved.starts_at.toISOString()).toBe(target);
      expect(saved.ends_at.toISOString()).toBe(at(day(7), '10:15'));

      const [audit] = await ctx.db.query(
        `SELECT actor_kind, before_json, after_json FROM audit_log
          WHERE entity_id = $1 AND action = 'appointment_rescheduled'`,
        [id],
      );
      expect(audit).toMatchObject({
        actor_kind: 'dentist',
        before_json: { startsAt: at(day(6), '08:00'), endsAt: at(day(6), '08:45') },
        after_json: { startsAt: target, endsAt: at(day(7), '10:15') },
      });
    });

    it('también mueve una por pagar y no cambia su estado ni su comprobante', async () => {
      const id = await appointment(at(day(6), '09:30'), 'por_pagar', 5);
      await ctx.db.query(
        `INSERT INTO payment_proof (appointment_id, receipt_number) VALUES ($1, 'MOVE-0001')`,
        [id],
      );
      await reschedule(id, at(day(8), '08:00')).expect(200);
      const saved = await row(id);
      expect(saved.status).toBe('por_pagar');
      const [proof] = await ctx.db.query(
        'SELECT receipt_number FROM payment_proof WHERE appointment_id = $1',
        [id],
      );
      expect(proof.receipt_number).toBe('MOVE-0001');
    });

    it('rechaza el mismo horario', async () => {
      const id = await appointment(at(day(8), '08:45'));
      const res = await reschedule(id, at(day(8), '08:45')).expect(409);
      expect(res.body.message).toMatch(/horario distinto/);
    });

    it('rechaza horarios que no son una franja publicada: fuera del intervalo, a deshoras o sin atención', async () => {
      const id = await appointment(at(day(8), '09:30'));
      const original = at(day(8), '09:30');
      for (const bad of [
        at(day(8), '07:15'), // antes del intervalo
        at(day(8), '11:15'), // la franja no cabe completa (termina 12:00)
        at(day(8), '08:20'), // fuera de la grilla de 45 min
        at(day(20), '08:00'), // día sin atención
      ]) {
        const res = await reschedule(id, bad).expect(409);
        expect(res.body.message).toMatch(/no está disponible/);
      }
      expect((await row(id)).starts_at.toISOString()).toBe(original);
    });

    it('rechaza una franja que ya empezó (hoy ya pasada)', async () => {
      const today = todayInClinicTimeZone();
      await interval(today, '00:00', '01:30'); // ya pasó seguro salvo entre 00:00 y 01:30 de La Paz
      const id = await appointment(at(day(9), '08:00'));
      const [{ n }] = await ctx.db.query(
        `SELECT count(*)::int AS n FROM availability_interval WHERE service_date = $1::date`,
        [today],
      );
      expect(n).toBeGreaterThan(0);
      const res = await reschedule(id, at(today, '00:00'));
      expect([409]).toContain(res.status);
    });

    it('rechaza una franja ocupada por otra consulta y deja la original donde estaba', async () => {
      const occupant = await appointment(at(day(9), '09:30'));
      const id = await appointment(at(day(9), '10:15'));
      const res = await reschedule(id, at(day(9), '09:30')).expect(409);
      expect(res.body.message).toMatch(/ocupada/);
      expect((await row(id)).starts_at.toISOString()).toBe(at(day(9), '10:15'));
      expect((await row(occupant)).starts_at.toISOString()).toBe(at(day(9), '09:30'));
    });

    it('una reserva vencida sin comprobante no estorba, pero una vencida con comprobante sí', async () => {
      const staleFree = await appointment(at(day(10), '08:45'), 'por_pagar', -3);
      const staleProof = await appointment(at(day(10), '09:30'), 'por_pagar', -3);
      await ctx.db.query(
        `INSERT INTO payment_proof (appointment_id, receipt_number) VALUES ($1, 'MOVE-0002')`,
        [staleProof],
      );
      const mover = await appointment(at(day(10), '08:00'));
      await reschedule(mover, at(day(10), '08:45')).expect(200);
      expect((await row(staleFree)).status).toBe('cancelada');
      await reschedule(mover, at(day(10), '09:30')).expect(409);
    });

    it('las consultas en estado final no se reprograman', async () => {
      for (const status of ['completada', 'cancelada', 'no_asistio']) {
        const id = await appointment(
          at(day(11), status === 'completada' ? '08:00' : '08:45'),
          status,
        );
        const res = await reschedule(id, at(day(11), '10:15')).expect(409);
        expect(res.body.message).toMatch(/ya no se puede reprogramar/);
        await ctx.db.query('DELETE FROM appointment WHERE id = $1', [id]).catch(() => undefined);
      }
    });

    it('dos consultas que piden la misma franja libre a la vez: una gana y la otra recibe 409', async () => {
      const a = await appointment(at(day(12), '08:00'));
      const b = await appointment(at(day(12), '08:45'));
      const target = at(day(12), '11:00');
      const results = await Promise.all([reschedule(a, target), reschedule(b, target)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });
  });

  describe('franjas libres del panel', () => {
    it('exige sesión y ofrece las franjas libres de un día', async () => {
      const date = day(5);
      await ctx.http().get(`/api/v1/admin/availability-slots?date=${date}`).expect(401);
      const res = await ctx
        .http()
        .get(`/api/v1/admin/availability-slots?date=${date}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body.date).toBe(date);
      expect(res.body.slots.length).toBeGreaterThan(0);
      await ctx
        .http()
        .get('/api/v1/admin/availability-slots?date=mal')
        .set('Cookie', cookie)
        .expect(400);
    });

    it('con hoy: solo franjas que aún no empezaron; el pasado no ofrece nada', async () => {
      const today = todayInClinicTimeZone();
      const res = await ctx
        .http()
        .get(`/api/v1/admin/availability-slots?date=${today}`)
        .set('Cookie', cookie)
        .expect(200);
      for (const slot of res.body.slots) {
        expect(new Date(slot.startsAt).getTime()).toBeGreaterThan(Date.now());
      }
      const past = await ctx
        .http()
        .get(`/api/v1/admin/availability-slots?date=${day(-3)}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(past.body.slots).toEqual([]);
    });

    it('el portal público sigue sin ofrecer hoy', async () => {
      const res = await ctx
        .http()
        .get(`/api/v1/availability/slots?date=${todayInClinicTimeZone()}`)
        .expect(200);
      expect(res.body.slots).toEqual([]);
    });
  });

  describe('no asistió', () => {
    const noShow = (id: string, withCookie = true) => post(id, 'no-show', {}, withCookie);
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

    it('sin sesión 401; id inválido 400; inexistente 404', async () => {
      const id = await appointment(hoursAgo(5));
      await noShow(id, false).expect(401);
      await noShow('no-es-uuid').expect(400);
      await noShow('3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b').expect(404);
      expect((await row(id)).status).toBe('confirmada');
    });

    it('marca una confirmada cuya hora ya pasó: estado final, anticipo retenido y auditoría', async () => {
      const id = await appointment(hoursAgo(6));
      const res = await noShow(id).expect(200);
      expect(res.body).toMatchObject({ id, status: 'no_asistio' });
      expect(await row(id)).toMatchObject({ status: 'no_asistio', refunded: 'no' });
      const [audit] = await ctx.db.query(
        `SELECT actor_kind, before_json, after_json FROM audit_log
          WHERE entity_id = $1 AND action = 'appointment_no_show'`,
        [id],
      );
      expect(audit).toMatchObject({
        actor_kind: 'dentist',
        before_json: { status: 'confirmada' },
        after_json: { status: 'no_asistio' },
      });
    });

    it('es un estado final: no se puede volver a modificar', async () => {
      const id = await appointment(hoursAgo(7));
      await noShow(id).expect(200);
      await expect(
        ctx.db.query(`UPDATE appointment SET status = 'confirmada' WHERE id = $1`, [id]),
      ).rejects.toMatchObject({ code: '23514' });
      await noShow(id).expect(409);
    });

    it('antes de la hora de inicio no se puede', async () => {
      const id = await appointment(at(day(6), '11:15'));
      const res = await noShow(id).expect(409);
      expect(res.body.message).toMatch(/Todavía no llegó la hora/);
      expect((await row(id)).status).toBe('confirmada');
    });

    it('solo desde confirmada: por pagar, cancelada y completada dan 409', async () => {
      for (const [status, offset] of [
        ['por_pagar', 8],
        ['cancelada', 9],
        ['completada', 10],
      ] as const) {
        const id = await appointment(hoursAgo(offset), status);
        const res = await noShow(id).expect(409);
        expect(res.body.message).toMatch(/Solo una consulta confirmada/);
        expect((await row(id)).status).toBe(status);
      }
    });

    it('varias marcas a la vez: una gana y las demás reciben 409', async () => {
      const id = await appointment(hoursAgo(11));
      const results = await Promise.all(Array.from({ length: 4 }, () => noShow(id)));
      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409]);
    });
  });
});
