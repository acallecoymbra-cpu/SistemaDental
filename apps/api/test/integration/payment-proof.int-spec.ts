import { todayInClinicTimeZone, type PublicBooking } from '@sistema-dental/contracts';
import { HoldExpirationJob } from '../../src/appointments/hold-expiration.job';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/** Comprobante de pago (T-07) con PostgreSQL real. Datos inventados. */
describe('comprobante de pago (T-07, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let treatmentId: string;
  let seq = 0;

  function addDays(days: number): string {
    const [y, m, d] = todayInClinicTimeZone().split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
  }
  const at = (date: string, hhmm: string) =>
    new Date(Date.parse(`${date}T${hhmm}:00.000Z`) + 4 * 3_600_000).toISOString();

  /** Reserva una franja nueva (cada llamada usa la siguiente de 45 min del día +20). */
  const registered = new Set<string>();

  /** Reserva como paciente nuevo; si ese celular ya reservó, como «ya estoy registrado». */
  async function reserve(phone?: string): Promise<PublicBooking> {
    seq += 1;
    const cel = phone ?? `7400${String(seq).padStart(4, '0')}`;
    const patient = registered.has(cel)
      ? {
          kind: 'returning',
          firstName: 'Paciente',
          firstSurname: `Comprobante ${cel}`,
          phoneCountryCode: '591',
          phone: cel,
          email: `c${seq}@ejemplo.test`,
        }
      : {
          kind: 'new',
          givenNames: 'Paciente',
          firstSurname: `Comprobante ${cel}`,
          ci: `CP${cel}`,
          phoneCountryCode: '591',
          phone: cel,
          email: `c${seq}@ejemplo.test`,
          birthDate: '1990-05-20',
        };
    registered.add(cel);
    const minutes = 8 * 60 + (seq - 1) * 45;
    const hhmm = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const res = await ctx
      .http()
      .post('/api/v1/appointments')
      .set('Origin', TEST_WEB_ORIGIN)
      .send({
        treatmentId,
        startsAt: at(addDays(20), hhmm),
        patient,
      })
      .expect(201);
    return res.body as PublicBooking;
  }

  const send = (id: string, receiptNumber: unknown) =>
    ctx
      .http()
      .post(`/api/v1/appointments/${id}/payment-proof`)
      .set('Origin', TEST_WEB_ORIGIN)
      .send({ receiptNumber });

  const expire = (id: string) =>
    ctx.db.query(
      `UPDATE appointment SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`,
      [id],
    );

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
    const [t] = await ctx.db.query('SELECT id FROM treatment WHERE active = true LIMIT 1');
    treatmentId = t.id;
    await ctx
      .http()
      .post('/api/v1/admin/availability-intervals')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ serviceDate: addDays(20), startsLocal: '08:00', endsLocal: '23:00' })
      .expect(201);
    await ctx
      .http()
      .patch('/api/v1/admin/clinic-settings')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ paymentQrRef: 'https://ejemplo.test/qr.png', whatsappPhone: '+59170000000' })
      .expect(200);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('la reserva devuelve el QR y el WhatsApp para pagar', async () => {
    const booking = await reserve();
    expect(booking.paymentQrRef).toBe('https://ejemplo.test/qr.png');
    expect(booking.whatsappPhone).toBe('+59170000000');
  });

  it('guarda el comprobante normalizado, la cita sigue por pagar y queda auditado sin el número', async () => {
    const booking = await reserve();
    const res = await send(booking.id, ' ab-1001 ').expect(201);
    expect(res.body).toMatchObject({ appointmentId: booking.id });
    expect(new Date(res.body.submittedAt).getTime()).toBeLessThanOrEqual(Date.now());

    const [proof] = await ctx.db.query(
      'SELECT receipt_number, confirmed_at FROM payment_proof WHERE appointment_id = $1',
      [booking.id],
    );
    expect(proof).toMatchObject({ receipt_number: 'AB-1001', confirmed_at: null });
    const [appointment] = await ctx.db.query('SELECT status FROM appointment WHERE id = $1', [
      booking.id,
    ]);
    expect(appointment.status).toBe('por_pagar');

    const [audit] = await ctx.db.query(
      `SELECT actor_kind, after_json FROM audit_log
        WHERE entity_id = $1 AND action = 'payment_proof_submitted'`,
      [booking.id],
    );
    expect(audit.actor_kind).toBe('anonymous');
    expect(JSON.stringify(audit.after_json)).not.toContain('AB-1001');
  });

  it('rechaza un número de comprobante repetido, aunque cambien mayúsculas', async () => {
    const first = await reserve();
    const second = await reserve();
    await send(first.id, 'DUP-2002').expect(201);
    const res = await send(second.id, 'dup-2002').expect(409);
    expect(res.body.message).toMatch(/ya fue registrado/);
    const [row] = await ctx.db.query(
      'SELECT count(*)::int AS n FROM payment_proof WHERE appointment_id = $1',
      [second.id],
    );
    expect(row.n).toBe(0);
  });

  it('no deja enviar dos comprobantes para la misma cita', async () => {
    const booking = await reserve();
    await send(booking.id, 'ONE-3003').expect(201);
    const res = await send(booking.id, 'TWO-3004').expect(409);
    expect(res.body.message).toMatch(/Ya enviaste el comprobante/);
  });

  it('con dos envíos a la vez del mismo número gana uno y el otro recibe 409', async () => {
    const [a, b] = [await reserve(), await reserve()];
    const results = await Promise.all([send(a.id, 'RACE-4004'), send(b.id, 'RACE-4004')]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('después de los 8 minutos rechaza el comprobante e indica escribir por WhatsApp', async () => {
    const booking = await reserve();
    await expire(booking.id);
    const res = await send(booking.id, 'LATE-5005').expect(409);
    expect(res.body.message).toMatch(/WhatsApp/);
    const [row] = await ctx.db.query(
      'SELECT count(*)::int AS n FROM payment_proof WHERE appointment_id = $1',
      [booking.id],
    );
    expect(row.n).toBe(0);
  });

  it('si la reserva ya fue cancelada por vencimiento, también indica WhatsApp', async () => {
    const booking = await reserve();
    await expire(booking.id);
    await ctx.app.get(HoldExpirationJob).runOnce();
    const res = await send(booking.id, 'GONE-6006').expect(409);
    expect(res.body.message).toMatch(/WhatsApp/);
  });

  it('valida el formato y el identificador, sin revelar datos', async () => {
    const booking = await reserve();
    for (const bad of [
      '',
      '123',
      'con espacio',
      "1234'; DROP TABLE appointment;--",
      12345678,
      null,
    ]) {
      await send(booking.id, bad).expect(400);
    }
    await ctx
      .http()
      .post('/api/v1/appointments/no-es-uuid/payment-proof')
      .set('Origin', TEST_WEB_ORIGIN)
      .send({ receiptNumber: 'OK-7007' })
      .expect(400);
    const unknown = await send('3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b', 'OK-7007').expect(404);
    expect(unknown.body.message).toBe('No encontramos esa reserva.');
  });

  it('una cita con comprobante no vence: la tarea no la cancela y la franja sigue ocupada', async () => {
    const booking = await reserve();
    await send(booking.id, 'KEEP-8008').expect(201);
    await expire(booking.id);
    await ctx.app.get(HoldExpirationJob).runOnce();
    const [row] = await ctx.db.query('SELECT status FROM appointment WHERE id = $1', [booking.id]);
    expect(row.status).toBe('por_pagar');

    const slots = await ctx
      .http()
      .get(`/api/v1/availability/slots?date=${addDays(20)}`)
      .expect(200);
    expect(slots.body.slots.map((s: { startsAt: string }) => s.startsAt)).not.toContain(
      booking.startsAt,
    );
    // Otra persona no puede reservar esa franja
    const again = await ctx
      .http()
      .post('/api/v1/appointments')
      .set('Origin', TEST_WEB_ORIGIN)
      .send({
        treatmentId,
        startsAt: booking.startsAt,
        patient: {
          kind: 'new',
          givenNames: 'Otra',
          firstSurname: 'Persona',
          ci: '7499999',
          phoneCountryCode: '591',
          phone: '74999999',
          email: 'o@ejemplo.test',
          birthDate: '1990-01-01',
        },
      })
      .expect(409);
    expect(again.body.message).toMatch(/ya no está disponible/);
  });

  it('las reservas con comprobante cuentan para el máximo de 3 pendientes', async () => {
    const phone = '74555555';
    const reserved: PublicBooking[] = [];
    for (let i = 0; i < 3; i += 1) reserved.push(await reserve(phone));
    for (const [i, booking] of reserved.entries()) {
      await send(booking.id, `MAX-900${i}`).expect(201);
      await expire(booking.id);
    }
    seq += 1;
    const res = await ctx
      .http()
      .post('/api/v1/appointments')
      .set('Origin', TEST_WEB_ORIGIN)
      .send({
        treatmentId,
        startsAt: at(addDays(20), '21:30'),
        patient: {
          kind: 'returning',
          firstName: 'Paciente',
          firstSurname: `Comprobante ${phone}`,
          phoneCountryCode: '591',
          phone,
          email: 'c@ejemplo.test',
        },
      })
      .expect(409);
    expect(res.body.message).toMatch(/pendientes/);
  });

  it('la agenda muestra el comprobante a la doctora', async () => {
    const booking = await reserve();
    await send(booking.id, 'AGE-1010').expect(201);
    const res = await ctx
      .http()
      .get(`/api/v1/admin/appointments/${booking.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.paymentProof).toMatchObject({ receiptNumber: 'AGE-1010', confirmedAt: null });
    const list = await ctx
      .http()
      .get(`/api/v1/admin/appointments?from=${addDays(20)}&to=${addDays(20)}`)
      .set('Cookie', cookie)
      .expect(200);
    const found = list.body.find((a: { id: string }) => a.id === booking.id);
    expect(found.paymentProof.receiptNumber).toBe('AGE-1010');
  });

  it('la base impide un número repetido o mal formado aunque se salte la API', async () => {
    const booking = await reserve();
    await expect(
      ctx.db.query(
        `INSERT INTO payment_proof (appointment_id, receipt_number) VALUES ($1, 'bad one')`,
        [booking.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
