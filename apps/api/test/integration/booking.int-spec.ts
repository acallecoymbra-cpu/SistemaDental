import { todayInClinicTimeZone, type PublicBooking } from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';
import { insertPatient } from './patient-fixtures';

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
      kind: 'new',
      givenNames: 'Paciente',
      firstSurname: `Reserva ${String.fromCharCode(96 + (phoneSeq % 26) + 1)}${phoneSeq}`,
      ci: String(4000000 + phoneSeq),
      phoneCountryCode: '591',
      phone: `7100${String(phoneSeq).padStart(4, '0')}`,
      email: `p${phoneSeq}@ejemplo.test`,
      birthDate: '1990-05-20',
      ...overrides,
    } as Record<string, unknown> & {
      givenNames: string;
      firstSurname: string;
      phone: string;
      email: string;
    };
  }

  /** El mismo paciente cuando vuelve: «Sí, ya estoy registrado». */
  const returningOf = (p: ReturnType<typeof newPatient>, overrides: object = {}) => ({
    kind: 'returning',
    firstName: p.givenNames,
    firstSurname: p.firstSurname,
    phoneCountryCode: p.phoneCountryCode,
    phone: p.phone,
    email: p.email,
    ...overrides,
  });

  /** Registra al paciente directo en la base (como si ya se hubiera atendido). */
  const register = (p: ReturnType<typeof newPatient>) =>
    insertPatient(ctx.db, {
      givenNames: p.givenNames,
      firstSurname: p.firstSurname,
      phone: p.phone,
      email: p.email,
      birthDate: '1990-05-20',
      origin: 'web',
    });

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
    // Días con horario: +2 a +11 (+10 y +11 son para las pruebas de pacientes nuevos/que vuelven)
    for (let i = 2; i <= 11; i += 1) {
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
      await register(patient);
      const hours = ['08:00', '08:45', '09:30', '10:15', '11:00'];
      const results = await Promise.all(hours.map((h) => book(at(day, h), returningOf(patient))));
      expect(results.filter((r) => r.status === 201)).toHaveLength(3);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    });

    it('la misma persona nueva reservando a la vez no se duplica: la segunda debe elegir «ya estoy registrado»', async () => {
      const day = addDays(8);
      const patient = newPatient();
      const results = await Promise.all(['08:00', '08:45'].map((h) => book(at(day, h), patient)));
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
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
      const made = [(await book(at(day, '08:00'), patient).expect(201)).body as PublicBooking];
      for (const h of ['08:45', '09:30']) {
        made.push((await book(at(day, h), returningOf(patient)).expect(201)).body as PublicBooking);
      }
      const res = await book(at(day, '10:15'), returningOf(patient)).expect(409);
      expect(res.body.message).toMatch(/3 consultas pendientes/);

      await ctx.db.query(
        `UPDATE appointment SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`,
        [made[0]!.id],
      );
      await book(at(day, '10:15'), returningOf(patient)).expect(201);
    });

    it('las confirmadas y las canceladas no cuentan como pendientes', async () => {
      const patient = newPatient();
      const confirmed = await book(at(addDays(8), '11:00'), patient).expect(201);
      await ctx.db.query(`UPDATE appointment SET status = 'confirmada' WHERE id = $1`, [
        confirmed.body.id,
      ]);
      const canceled = await book(at(addDays(8), '10:15'), returningOf(patient)).expect(201);
      await ctx.db.query(`UPDATE appointment SET status = 'cancelada' WHERE id = $1`, [
        canceled.body.id,
      ]);
      // Con una confirmada y una cancelada todavía caben 3 pendientes
      await book(at(addDays(8), '09:30'), returningOf(patient)).expect(201);
      await book(at(addDays(5), '09:30'), returningOf(patient)).expect(201);
      await book(at(addDays(5), '10:15'), returningOf(patient)).expect(201);
      await book(at(addDays(5), '11:00'), returningOf(patient)).expect(409);
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
      const p = newPatient({ givenNames: 'José', firstSurname: 'Ramírez Único' });
      await book(at(day, '11:00'), p).expect(201);
      const again = returningOf(p, {
        firstName: 'JOSE',
        firstSurname: 'RAMIREZ UNICO',
        phone: `+591 ${p.phone}`,
        email: 'otro@ejemplo.test',
      });
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
      // un menor no necesita CI
      const child = newPatient({ birthDate: `${year}-03-15`, ci: undefined });
      const res = await book(at(day, '11:00'), child).expect(400);
      expect(res.body.message).toBe(
        'Un paciente menor de edad necesita el celular de su apoderado.',
      );
      await book(at(day, '11:00'), {
        ...child,
        guardianPhoneCountryCode: '591',
        guardianPhone: '70999999',
      }).expect(201);
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
      // Bolivia exige 8 dígitos
      await book(at(addDays(4), '11:00'), newPatient({ phone: '7100123' })).expect(400);
    });

    it('un adulto nuevo debe dar su CI', async () => {
      const res = await book(at(addDays(4), '11:00'), newPatient({ ci: undefined })).expect(400);
      expect(res.body.message).toBe('Para registrarte necesitamos tu CI.');
    });

    it('un CI ya usado da un error genérico que no revela que el CI existe', async () => {
      const first = newPatient();
      await book(at(addDays(10), '08:00'), first).expect(201);
      const res = await book(at(addDays(10), '08:45'), newPatient({ ci: first.ci })).expect(400);
      expect(res.body.message).toBe('No pudimos registrar tus datos. Escríbenos por WhatsApp.');
    });

    it('un registro nuevo de alguien que ya existe pide elegir «Sí, ya estoy registrado»', async () => {
      const p = newPatient();
      await book(at(addDays(10), '09:30'), p).expect(201);
      const res = await book(at(addDays(10), '10:15'), { ...p, ci: '8887776' }).expect(409);
      expect(res.body.message).toBe(
        'Ya hay un paciente con ese nombre y celular. Si eres tú, elige "Sí, ya estoy registrado"; si no, escríbenos por WhatsApp.',
      );
    });

    it('al volver se reconoce con el primer nombre y el apellido compuesto escrito distinto', async () => {
      const p = newPatient({
        givenNames: 'María José',
        firstSurname: 'de la Roca',
        phone: '71200001',
      });
      await register(p);
      await book(
        at(addDays(11), '08:00'),
        returningOf(p, { firstName: 'maria', firstSurname: 'DE LA ROCA' }),
      ).expect(201);
      const rows = await ctx.db.query('SELECT id FROM patient WHERE phone = $1', ['71200001']);
      expect(rows).toHaveLength(1);
      const [appt] = await ctx.db.query(
        'SELECT patient_id FROM appointment WHERE patient_id = $1',
        [rows[0].id],
      );
      expect(appt.patient_id).toBe(rows[0].id);
    });

    it('un menor que vuelve se reconoce con el celular de su apoderado', async () => {
      const id = await insertPatient(ctx.db, {
        givenNames: 'Tomás',
        firstSurname: 'Vaca',
        phone: '71300001',
        birthDate: '2018-01-01',
        guardianPhone: '71300099',
      });
      await book(at(addDays(11), '08:45'), {
        kind: 'returning',
        firstName: 'Tomas',
        firstSurname: 'Vaca',
        phoneCountryCode: '591',
        phone: '71300099',
        email: 'tomas@ejemplo.test',
      }).expect(201);
      const [appt] = await ctx.db.query('SELECT 1 FROM appointment WHERE patient_id = $1', [id]);
      expect(appt).toBeDefined();
    });

    it('un menor nuevo cuyo apoderado ya es paciente con el mismo nombre no deja la consulta ambigua', async () => {
      await insertPatient(ctx.db, { givenNames: 'Juan', firstSurname: 'Ríos', phone: '71600001' });
      const year = Number(todayInClinicTimeZone().slice(0, 4)) - 9;
      const res = await book(at(addDays(11), '10:15'), {
        kind: 'new',
        givenNames: 'Juan',
        firstSurname: 'Ríos',
        phoneCountryCode: '591',
        phone: '71600002',
        guardianPhoneCountryCode: '591',
        guardianPhone: '71600001',
        email: 'juanito@ejemplo.test',
        birthDate: `${year}-01-10`,
      }).expect(409);
      expect(res.body.message).toMatch(/Ya hay un paciente con ese nombre y celular/);
    });

    it('dos registros nuevos simultáneos que dejarían la consulta ambigua: solo uno se crea', async () => {
      const base = {
        kind: 'new',
        firstSurname: 'Carrera',
        phoneCountryCode: '591',
        phone: '71700001',
        email: 'carrera@ejemplo.test',
        birthDate: '1990-01-01',
      };
      const results = await Promise.all([
        book(at(addDays(11), '11:00'), { ...base, givenNames: 'María', ci: '9100001' }),
        book(at(addDays(10), '11:00'), { ...base, givenNames: 'María José', ci: '9100002' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const rows = await ctx.db.query('SELECT 1 FROM patient WHERE phone = $1', ['71700001']);
      expect(rows).toHaveLength(1);
    });

    it('al volver: sin coincidencias 400; con dos coincidencias 409', async () => {
      const none = await book(at(addDays(11), '09:30'), {
        kind: 'returning',
        firstName: 'Nadie',
        firstSurname: 'Existe',
        phoneCountryCode: '591',
        phone: '71400001',
        email: 'nadie@ejemplo.test',
      }).expect(400);
      expect(none.body.message).toBe(
        'No encontramos tus datos. Si es tu primera vez, elige "No, es mi primera vez".',
      );

      await insertPatient(ctx.db, { givenNames: 'Juan', firstSurname: 'Paz', phone: '71500001' });
      await insertPatient(ctx.db, {
        givenNames: 'Juan Carlos',
        firstSurname: 'Paz',
        phone: '71500001',
      });
      const two = await book(at(addDays(11), '09:30'), {
        kind: 'returning',
        firstName: 'Juan',
        firstSurname: 'Paz',
        phoneCountryCode: '591',
        phone: '71500001',
        email: 'juan@ejemplo.test',
      }).expect(409);
      expect(two.body.message).toBe(
        'Hay más de un paciente con esos datos. Escríbenos por WhatsApp.',
      );
    });
  });

  describe('límite de intentos al volver (RF-09, compartido con «Mis consultas»)', () => {
    const unknown = (n: number) => ({
      kind: 'returning',
      firstName: 'Nadie',
      firstSurname: `Inventado ${n}`,
      phoneCountryCode: '591',
      phone: `7180000${n}`,
      email: 'nadie@ejemplo.test',
    });
    const lookup = (body: object) =>
      ctx.http().post('/api/v1/appointments/lookup').set('Origin', TEST_WEB_ORIGIN).send(body);

    beforeEach(async () => {
      await ctx.db.query('DELETE FROM public_lookup_attempt');
    });
    afterAll(async () => {
      await ctx.db.query('DELETE FROM public_lookup_attempt');
    });

    it('cada «ya estoy registrado» sin coincidencias cuenta como intento fallido', async () => {
      await book(at(addDays(11), '09:30'), unknown(1)).expect(400);
      const rows = await ctx.db.query(
        'SELECT successful FROM public_lookup_attempt ORDER BY attempted_at',
      );
      expect(rows).toEqual([{ successful: false }]);
    });

    it('tras 5 fallos se bloquea la reserva de quien vuelve y también «Mis consultas»', async () => {
      const p = newPatient({ phone: '71800099' });
      await register(p);
      for (let i = 1; i <= 5; i += 1) {
        await book(at(addDays(11), '09:30'), unknown(i)).expect(400);
      }
      // Bloqueado: ni con datos correctos
      const res = await book(at(addDays(11), '09:30'), returningOf(p)).expect(429);
      expect(res.body.message).toMatch(/Demasiados intentos/);
      await lookup({
        firstName: p.givenNames,
        firstSurname: p.firstSurname,
        phoneCountryCode: '591',
        phone: p.phone,
      }).expect(429);
      // El registro de pacientes nuevos no se bloquea
      await book(at(addDays(11), '09:30'), newPatient()).expect(201);
    });

    it('los fallos de «Mis consultas» también bloquean la reserva de quien vuelve', async () => {
      for (let i = 1; i <= 5; i += 1) {
        await lookup({
          firstName: 'Nadie',
          firstSurname: `Busca ${i}`,
          phoneCountryCode: '591',
          phone: '71900001',
        }).expect(404);
      }
      await book(at(addDays(10), '11:00'), unknown(9)).expect(429);
    });

    it('varias coincidencias (409) no cuentan como intento fallido', async () => {
      await insertPatient(ctx.db, { givenNames: 'Rosa', firstSurname: 'Lima', phone: '71950001' });
      await insertPatient(ctx.db, {
        givenNames: 'Rosa María',
        firstSurname: 'Lima',
        phone: '71950001',
      });
      await book(at(addDays(10), '11:00'), {
        kind: 'returning',
        firstName: 'Rosa',
        firstSurname: 'Lima',
        phoneCountryCode: '591',
        phone: '71950001',
        email: 'rosa@ejemplo.test',
      }).expect(409);
      expect(await ctx.db.query('SELECT 1 FROM public_lookup_attempt')).toHaveLength(0);
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
