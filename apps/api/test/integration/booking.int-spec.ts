import { todayInClinicTimeZone, type PublicBooking } from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/** Reserva pública (T-06) con PostgreSQL real, incluida la concurrencia. Datos inventados. */
describe('reserva pública (T-06, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let treatmentId: string;
  let inactiveTreatmentId: string;
  let phoneSeq = 0;

  const BOOK = '/api/v1/appointments';

  function addDays(days: number): string {
    const [y, m, d] = todayInClinicTimeZone().split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
  }

  /** Instante UTC de una hora local de La Paz (UTC-4). */
  const at = (date: string, hhmm: string) =>
    `${date}T${String(Number(hhmm.slice(0, 2)) + 4).padStart(2, '0')}:${hhmm.slice(3)}:00.000Z`;

  function newPatient(overrides: Record<string, unknown> = {}) {
    phoneSeq += 1;
    return {
      fullName: `Paciente Reserva ${phoneSeq}`,
      phone: `7100${String(phoneSeq).padStart(4, '0')}`,
      email: `p${phoneSeq}@ejemplo.test`,
      birthDate: '1990-05-20',
      ...overrides,
    };
  }

  const book = (startsAt: string, patient: object, extra: object = {}) =>
    ctx
      .http()
      .post(BOOK)
      .set('Origin', TEST_WEB_ORIGIN)
      .send({ treatmentId, startsAt, patient, ...extra });

  async function interval(date: string, from: string, to: string) {
    await ctx
      .http()
      .post('/api/v1/admin/availability-intervals')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ serviceDate: date, startsLocal: from, endsLocal: to })
      .expect(201);
  }

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
    const [t] = await ctx.db.query('SELECT id FROM treatment WHERE active = true LIMIT 1');
    treatmentId = t.id;
    const [inactive] = await ctx.db.query(
      `INSERT INTO treatment (name, active) VALUES ('Inactivo Prueba', false) RETURNING id`,
    );
    inactiveTreatmentId = inactive.id;
    // Días con horario: +2 a +9
    for (let i = 2; i <= 9; i += 1) {
      await interval(addDays(i), '08:00', '12:00');
    }
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('es público: reserva sin sesión, deja la cita por pagar con 8 min de espera', async () => {
    const day = addDays(2);
    const res = await book(at(day, '08:00'), newPatient()).expect(201);
    const booking = res.body as PublicBooking;
    expect(booking).toMatchObject({
      status: 'por_pagar',
      startsAt: at(day, '08:00'),
      endsAt: at(day, '08:45'),
      depositCents: 1000,
    });
    expect(booking.treatmentName).toEqual(expect.any(String));
    const hold = new Date(booking.holdExpiresAt).getTime() - Date.now();
    expect(hold).toBeGreaterThan(7 * 60_000);
    expect(hold).toBeLessThanOrEqual(8 * 60_000);

    const [row] = await ctx.db.query(
      'SELECT status, origin, deposit_cents FROM appointment WHERE id = $1',
      [booking.id],
    );
    expect(row).toMatchObject({ status: 'por_pagar', origin: 'web', deposit_cents: '1000' });
    const [audit] = await ctx.db.query(
      `SELECT actor_kind, action, after_json FROM audit_log WHERE entity_id = $1`,
      [booking.id],
    );
    expect(audit).toMatchObject({ actor_kind: 'anonymous', action: 'appointment_created' });
    expect(JSON.stringify(audit.after_json)).not.toMatch(/@ejemplo|7100/);
  });

  it('la franja reservada deja de aparecer en los horarios libres', async () => {
    const day = addDays(3);
    await book(at(day, '09:30'), newPatient()).expect(201);
    const slots = await ctx.http().get(`/api/v1/availability/slots?date=${day}`).expect(200);
    expect(slots.body.slots.map((s: { startsLocal: string }) => s.startsLocal)).not.toContain(
      '09:30',
    );
  });

  it('el depósito es el vigente al reservar (snapshot) y no cambia después', async () => {
    const day = addDays(3);
    const res = await book(at(day, '08:00'), newPatient()).expect(201);
    await ctx
      .http()
      .patch('/api/v1/admin/clinic-settings')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ depositCents: 1500 })
      .expect(200);
    const [row] = await ctx.db.query('SELECT deposit_cents FROM appointment WHERE id = $1', [
      res.body.id,
    ]);
    expect(row.deposit_cents).toBe('1000');
    await ctx
      .http()
      .patch('/api/v1/admin/clinic-settings')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ depositCents: 1000 })
      .expect(200);
  });

  describe('franja', () => {
    it('rechaza horarios que no se ofrecen (hoy, fuera de grilla, fuera de intervalo, sin intervalo)', async () => {
      const day = addDays(4);
      await book(at(day, '08:15'), newPatient()).expect(409); // fuera de la grilla
      await book(at(day, '12:00'), newPatient()).expect(409); // fuera del intervalo
      await book(at(day, '07:00'), newPatient()).expect(409);
      await book(at(addDays(20), '08:00'), newPatient()).expect(409); // sin intervalo
      await interval(addDays(0), '08:00', '12:00');
      await book(at(addDays(0), '08:00'), newPatient()).expect(409); // hoy
    });

    it('una franja ocupada responde 409 y no crea otra cita', async () => {
      const day = addDays(4);
      await book(at(day, '10:15'), newPatient()).expect(201);
      const res = await book(at(day, '10:15'), newPatient()).expect(409);
      expect(res.body.message).toBe('Ese horario ya no está disponible. Elige otro.');
      const [{ n }] = await ctx.db.query(
        `SELECT count(*)::int AS n FROM appointment WHERE starts_at = $1`,
        [at(day, '10:15')],
      );
      expect(n).toBe(1);
    });

    it('una reserva vencida libera la franja: la nueva reserva pasa y la vieja queda cancelada', async () => {
      const day = addDays(5);
      const first = await book(at(day, '08:00'), newPatient()).expect(201);
      await ctx.db.query(
        `UPDATE appointment SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`,
        [first.body.id],
      );
      await book(at(day, '08:00'), newPatient()).expect(201);
      const [old] = await ctx.db.query(
        'SELECT status, cancel_reason FROM appointment WHERE id = $1',
        [first.body.id],
      );
      expect(old).toMatchObject({ status: 'cancelada', cancel_reason: 'Reserva vencida' });
    });

    it('una cita confirmada nunca se libera aunque pase el tiempo', async () => {
      const day = addDays(5);
      const first = await book(at(day, '08:45'), newPatient()).expect(201);
      await ctx.db.query(
        `UPDATE appointment SET status = 'confirmada', hold_expires_at = now() - interval '1 hour' WHERE id = $1`,
        [first.body.id],
      );
      await book(at(day, '08:45'), newPatient()).expect(409);
    });
  });

  describe('concurrencia', () => {
    it('dos pacientes que reservan la MISMA franja a la vez: solo uno lo logra', async () => {
      const day = addDays(6);
      const results = await Promise.all(
        Array.from({ length: 8 }, () => book(at(day, '08:00'), newPatient())),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(7);
      const [{ n }] = await ctx.db.query(
        `SELECT count(*)::int AS n FROM appointment WHERE starts_at = $1 AND status = 'por_pagar'`,
        [at(day, '08:00')],
      );
      expect(n).toBe(1);
    });

    it('el mismo paciente con 6 reservas simultáneas en franjas distintas: máximo 3', async () => {
      const day = addDays(7);
      const patient = newPatient();
      const hours = ['08:00', '08:45', '09:30', '10:15', '11:00'];
      const results = await Promise.all(hours.map((h) => book(at(day, h), patient)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(3);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    });

    it('la misma persona nueva reservando a la vez no se duplica como paciente', async () => {
      const day = addDays(8);
      const patient = newPatient();
      const results = await Promise.all(['08:00', '08:45'].map((h) => book(at(day, h), patient)));
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      const [{ n }] = await ctx.db.query(
        `SELECT count(*)::int AS n FROM patient WHERE phone = $1`,
        [patient.phone],
      );
      expect(n).toBe(1);
    });
  });

  describe('límite de 3 pendientes', () => {
    it('la cuarta reserva se rechaza; cancelar una libera el cupo; una vencida no cuenta', async () => {
      const day = addDays(9);
      const patient = newPatient();
      const made = [];
      for (const h of ['08:00', '08:45', '09:30']) {
        made.push((await book(at(day, h), patient).expect(201)).body as PublicBooking);
      }
      const res = await book(at(day, '10:15'), patient).expect(409);
      expect(res.body.message).toMatch(/3 consultas pendientes/);

      await ctx.db.query(
        `UPDATE appointment SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`,
        [made[0]!.id],
      );
      await book(at(day, '10:15'), patient).expect(201);
    });

    it('las confirmadas y las canceladas no cuentan como pendientes', async () => {
      const patient = newPatient();
      const confirmed = await book(at(addDays(8), '11:00'), patient).expect(201);
      await ctx.db.query(`UPDATE appointment SET status = 'confirmada' WHERE id = $1`, [
        confirmed.body.id,
      ]);
      const canceled = await book(at(addDays(8), '10:15'), patient).expect(201);
      await ctx.db.query(`UPDATE appointment SET status = 'cancelada' WHERE id = $1`, [
        canceled.body.id,
      ]);
      // Con una confirmada y una cancelada todavía caben 3 pendientes
      await book(at(addDays(8), '09:30'), patient).expect(201);
      await book(at(addDays(5), '09:30'), patient).expect(201);
      await book(at(addDays(5), '10:15'), patient).expect(201);
      await book(at(addDays(5), '11:00'), patient).expect(409);
    });
  });

  describe('pacientes', () => {
    it('crea al paciente nuevo con origen web; correo y fecha de nacimiento son obligatorios la primera vez', async () => {
      const day = addDays(2);
      const p = newPatient();
      await book(at(day, '09:30'), p).expect(201);
      const [row] = await ctx.db.query(
        'SELECT origin, email, is_minor FROM patient WHERE phone = $1',
        [p.phone],
      );
      expect(row).toMatchObject({ origin: 'web', email: p.email, is_minor: false });

      const sin = newPatient({ birthDate: undefined });
      const res = await book(at(day, '10:15'), sin).expect(400);
      expect(res.body.message).toMatch(/fecha de nacimiento/);
      await book(at(day, '10:15'), newPatient({ email: '' })).expect(400);
      await book(at(day, '10:15'), newPatient({ email: 'no-es-correo' })).expect(400);
    });

    it('reconoce al paciente que ya existe (nombre sin tildes + celular) sin duplicarlo ni cambiarle datos', async () => {
      const day = addDays(2);
      const p = newPatient({ fullName: 'José Ramírez Único' });
      await book(at(day, '11:00'), p).expect(201);
      const again = {
        fullName: 'JOSE RAMIREZ UNICO',
        phone: `+591 ${p.phone}`,
        email: 'otro@ejemplo.test',
      };
      await book(at(addDays(3), '10:15'), again).expect(201); // sin fecha de nacimiento: ya existe
      const rows = await ctx.db.query('SELECT full_name, email FROM patient WHERE phone = $1', [
        p.phone,
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ full_name: 'José Ramírez Único', email: p.email });
    });

    it('un menor exige el celular del apoderado y queda con la etiqueta', async () => {
      const day = addDays(4);
      const year = Number(todayInClinicTimeZone().slice(0, 4)) - 9;
      const child = newPatient({ birthDate: `${year}-03-15` });
      const res = await book(at(day, '11:00'), child).expect(400);
      expect(res.body.message).toBe(
        'Un paciente menor de edad necesita el celular de su apoderado.',
      );
      await book(at(day, '11:00'), { ...child, guardianPhone: '70999999' }).expect(201);
      const [row] = await ctx.db.query(
        'SELECT is_minor, guardian_phone FROM patient WHERE phone = $1',
        [child.phone],
      );
      expect(row).toMatchObject({ is_minor: true, guardian_phone: '70999999' });
    });

    it('si falla la reserva no queda el paciente creado (todo o nada)', async () => {
      const day = addDays(6);
      const occupied = at(day, '08:00'); // ocupada en la prueba de concurrencia
      const p = newPatient();
      await book(occupied, p).expect(409);
      const rows = await ctx.db.query('SELECT 1 FROM patient WHERE phone = $1', [p.phone]);
      expect(rows).toHaveLength(0);
    });

    it('celular inválido da 400', async () => {
      await book(at(addDays(4), '11:00'), newPatient({ phone: 'abc' })).expect(400);
    });
  });

  describe('validación del cuerpo', () => {
    it('rechaza tratamientos inexistentes, inactivos o mal formados, y fechas inválidas', async () => {
      const day = addDays(4);
      const p = newPatient();
      await ctx
        .http()
        .post(BOOK)
        .set('Origin', TEST_WEB_ORIGIN)
        .send({
          treatmentId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
          startsAt: at(day, '11:00'),
          patient: p,
        })
        .expect(404);
      await ctx
        .http()
        .post(BOOK)
        .set('Origin', TEST_WEB_ORIGIN)
        .send({ treatmentId: inactiveTreatmentId, startsAt: at(day, '11:00'), patient: p })
        .expect(404);
      await ctx
        .http()
        .post(BOOK)
        .set('Origin', TEST_WEB_ORIGIN)
        .send({ treatmentId: 'x', startsAt: at(day, '11:00'), patient: p })
        .expect(400);
      await book('mañana', p).expect(400);
      await ctx
        .http()
        .post(BOOK)
        .set('Origin', TEST_WEB_ORIGIN)
        .send({ treatmentId, startsAt: at(day, '11:00') })
        .expect(400);
      await book(at(day, '11:00'), p, { extra: 1 }).expect(400);
    });

    it('sin Origin permitido se rechaza (protección CSRF)', async () => {
      await ctx
        .http()
        .post(BOOK)
        .send({ treatmentId, startsAt: at(addDays(4), '11:00'), patient: newPatient() })
        .expect(403);
    });
  });
});
