import { HoldExpirationJob } from '../../src/appointments/hold-expiration.job';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/** Confirmar pago (T-11) con PostgreSQL real. Datos inventados. */
describe('confirmar pago (T-11, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let treatmentId: string;
  let patientId: string;
  let slot = 0;
  let receipt = 0;

  const confirm = (id: string, withCookie = true) => {
    const req = ctx
      .http()
      .post(`/api/v1/admin/appointments/${id}/confirm-payment`)
      .set('Origin', TEST_WEB_ORIGIN);
    return withCookie ? req.set('Cookie', cookie) : req;
  };

  /** Crea una cita en su propia franja; con `proof` también el comprobante. */
  async function appointment(status: string, proof: boolean, holdMinutes: number | null = null) {
    slot += 1;
    const [row] = await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin, hold_expires_at)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + interval '45 minutes', $4, 1000, 'web',
               CASE WHEN $5::int IS NULL THEN NULL ELSE now() + make_interval(mins => $5::int) END)
       RETURNING id`,
      [
        patientId,
        treatmentId,
        new Date(Date.UTC(2036, 0, 1, 12, slot * 45)).toISOString(),
        status,
        holdMinutes,
      ],
    );
    if (proof) {
      receipt += 1;
      await ctx.db.query(
        `INSERT INTO payment_proof (appointment_id, receipt_number) VALUES ($1, $2)`,
        [row.id, `CONF-${String(receipt).padStart(4, '0')}`],
      );
    }
    return row.id as string;
  }

  const stateOf = async (id: string) =>
    (
      await ctx.db.query(
        `SELECT a.status, a.hold_expires_at, pp.confirmed_at, pp.confirmed_by
           FROM appointment a LEFT JOIN payment_proof pp ON pp.appointment_id = a.id
          WHERE a.id = $1`,
        [id],
      )
    )[0];

  const auditCount = async (id: string) =>
    (
      await ctx.db.query(
        `SELECT count(*)::int AS n FROM audit_log
          WHERE entity_id = $1 AND action = 'appointment_payment_confirmed'`,
        [id],
      )
    )[0].n as number;

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
    const [t] = await ctx.db.query('SELECT id FROM treatment WHERE active = true LIMIT 1');
    treatmentId = t.id;
    const [p] = await ctx.db.query(
      `INSERT INTO patient (full_name, normalized_name, phone, origin)
       VALUES ('Paciente Confirma', 'paciente confirma', '75500001', 'web') RETURNING id`,
    );
    patientId = p.id;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('sin sesión responde 401 y no cambia nada', async () => {
    const id = await appointment('por_pagar', true, 5);
    await confirm(id, false).expect(401);
    expect((await stateOf(id)).status).toBe('por_pagar');
  });

  it('identificador inválido da 400 y uno que no existe da 404', async () => {
    await confirm('no-es-uuid').expect(400);
    await confirm('3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b').expect(404);
  });

  it('confirma: la cita queda confirmada, con quién y cuándo, y sin plazo de reserva', async () => {
    const id = await appointment('por_pagar', true, 5);
    const res = await confirm(id).expect(200);
    expect(res.body).toMatchObject({
      id,
      status: 'confirmada',
      holdExpiresAt: null,
      paymentProof: { confirmedAt: expect.any(String) },
    });
    const state = await stateOf(id);
    expect(state.status).toBe('confirmada');
    expect(state.hold_expires_at).toBeNull();
    expect(state.confirmed_at).toBeInstanceOf(Date);
    const [dentist] = await ctx.db.query('SELECT id FROM dentist_user WHERE active = true LIMIT 1');
    expect(state.confirmed_by).toBe(dentist.id);

    const [audit] = await ctx.db.query(
      `SELECT actor_kind, actor_user_id, before_json, after_json FROM audit_log
        WHERE entity_id = $1 AND action = 'appointment_payment_confirmed'`,
      [id],
    );
    expect(audit).toMatchObject({
      actor_kind: 'dentist',
      actor_user_id: dentist.id,
      before_json: { status: 'por_pagar' },
      after_json: { status: 'confirmada' },
    });
  });

  it('sin comprobante no se puede confirmar', async () => {
    const id = await appointment('por_pagar', false, 5);
    const res = await confirm(id).expect(409);
    expect(res.body.message).toMatch(/aún no tiene comprobante/);
    expect((await stateOf(id)).status).toBe('por_pagar');
  });

  it('solo se confirma una por pagar: canceladas y completadas dan 409', async () => {
    for (const status of ['cancelada', 'completada', 'no_asistio']) {
      const id = await appointment(status, true);
      await confirm(id).expect(409);
      expect((await stateOf(id)).status).toBe(status);
    }
  });

  it('se puede confirmar aunque el plazo de 8 minutos ya haya pasado (tiene comprobante)', async () => {
    const id = await appointment('por_pagar', true, -3);
    await confirm(id).expect(200);
    expect((await stateOf(id)).status).toBe('confirmada');
  });

  it('una confirmada ya no la cancela la tarea de vencimiento', async () => {
    const id = await appointment('por_pagar', true, -3);
    await confirm(id).expect(200);
    await ctx.app.get(HoldExpirationJob).runOnce();
    expect((await stateOf(id)).status).toBe('confirmada');
  });

  it('confirmar dos veces seguidas da el mismo resultado y audita una sola vez', async () => {
    const id = await appointment('por_pagar', true, 5);
    const first = await confirm(id).expect(200);
    const second = await confirm(id).expect(200);
    expect(second.body.paymentProof.confirmedAt).toBe(first.body.paymentProof.confirmedAt);
    expect(await auditCount(id)).toBe(1);
  });

  it('seis confirmaciones en paralelo no generan error y dejan un solo registro', async () => {
    const id = await appointment('por_pagar', true, 5);
    const results = await Promise.all(Array.from({ length: 6 }, () => confirm(id)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(await auditCount(id)).toBe(1);
    expect((await stateOf(id)).status).toBe('confirmada');
  });

  it('no existe forma de rechazar el pago', async () => {
    const id = await appointment('por_pagar', true, 5);
    const base = `/api/v1/admin/appointments/${id}`;
    for (const path of ['reject-payment', 'reject', 'payment-proof']) {
      const http = ctx.http();
      for (const attempt of [http.post(`${base}/${path}`), http.delete(`${base}/${path}`)]) {
        const res = await attempt.set('Origin', TEST_WEB_ORIGIN).set('Cookie', cookie);
        expect(res.status).toBe(404);
      }
    }
    expect((await stateOf(id)).status).toBe('por_pagar');
  });

  it('el filtro «por confirmar» muestra solo las por pagar con comprobante sin confirmar', async () => {
    await ctx.db.query('DELETE FROM payment_proof');
    await ctx.db.query('DELETE FROM appointment');
    const pending = await appointment('por_pagar', true, 5);
    await appointment('por_pagar', false, 5);
    const done = await appointment('por_pagar', true, 5);
    await confirm(done).expect(200);
    await appointment('confirmada', false);
    const res = await ctx
      .http()
      .get('/api/v1/admin/appointments?from=2036-01-01&to=2036-01-31&review=true')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.map((a: { id: string }) => a.id)).toEqual([pending]);
  });
});
