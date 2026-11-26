import { HoldExpirationJob } from '../../src/appointments/hold-expiration.job';
import { startTestApp, type TestApp } from './helpers';

/** Vencimiento automático de reservas (T-08) con PostgreSQL real. */
describe('vencimiento de reservas (T-08, PostgreSQL real)', () => {
  let ctx: TestApp;
  let job: HoldExpirationJob;
  let patientId: string;
  let treatmentId: string;
  let slot = 0;

  /** Inserta una cita con un plazo relativo a ahora (minutos; negativo = ya venció). */
  async function appointment(status: string, holdMinutes: number | null): Promise<string> {
    slot += 1;
    const [row] = await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin, hold_expires_at)
       VALUES ($1, $2, '2032-01-01T12:00:00Z'::timestamptz + make_interval(mins => $3::int),
                       '2032-01-01T12:45:00Z'::timestamptz + make_interval(mins => $3::int),
               $4, 1000, 'web',
               CASE WHEN $5::int IS NULL THEN NULL ELSE now() + make_interval(mins => $5::int) END)
       RETURNING id`,
      [patientId, treatmentId, slot * 45, status, holdMinutes],
    );
    return row.id;
  }

  const statusOf = async (id: string) =>
    (
      await ctx.db.query(
        'SELECT status, cancel_reason, canceled_at FROM appointment WHERE id = $1',
        [id],
      )
    )[0];

  const expiredAuditCount = async () =>
    (
      await ctx.db.query(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'appointment_hold_expired'`,
      )
    )[0].n;

  beforeAll(async () => {
    ctx = await startTestApp();
    job = ctx.app.get(HoldExpirationJob);
    const [patient] = await ctx.db.query(
      `INSERT INTO patient (full_name, normalized_name, phone, origin)
       VALUES ('Paciente Vence', 'paciente vence', '70800001', 'dentist') RETURNING id`,
    );
    patientId = patient.id;
    treatmentId = (await ctx.db.query('SELECT id FROM treatment LIMIT 1'))[0].id;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('en pruebas no arranca sola (no hay temporizador activo)', () => {
    expect((job as unknown as { timer?: unknown }).timer).toBeUndefined();
  });

  it('cancela las reservas vencidas, con motivo, fecha y auditoría del sistema', async () => {
    const expired = await appointment('por_pagar', -1);
    const before = await expiredAuditCount();
    expect(await job.runOnce()).toBeGreaterThanOrEqual(1);
    expect(await statusOf(expired)).toMatchObject({
      status: 'cancelada',
      cancel_reason: 'Reserva vencida',
    });
    expect((await statusOf(expired)).canceled_at).not.toBeNull();
    expect(await expiredAuditCount()).toBe(before + 1);
    const [audit] = await ctx.db.query(
      `SELECT actor_kind, actor_user_id FROM audit_log WHERE entity_id = $1 AND action = 'appointment_hold_expired'`,
      [expired],
    );
    expect(audit).toMatchObject({ actor_kind: 'system', actor_user_id: null });
  });

  it('no toca reservas vigentes, sin plazo, confirmadas ni de otros estados', async () => {
    const vigente = await appointment('por_pagar', 5);
    const sinPlazo = await appointment('por_pagar', null);
    const confirmada = await appointment('confirmada', -30);
    const completada = await appointment('completada', -30);
    const noAsistio = await appointment('no_asistio', -30);
    await job.runOnce();
    expect((await statusOf(vigente)).status).toBe('por_pagar');
    expect((await statusOf(sinPlazo)).status).toBe('por_pagar');
    expect((await statusOf(confirmada)).status).toBe('confirmada');
    expect((await statusOf(completada)).status).toBe('completada');
    expect((await statusOf(noAsistio)).status).toBe('no_asistio');
  });

  it('ejecutarla dos veces seguidas no cambia el resultado la segunda vez', async () => {
    const a = await appointment('por_pagar', -2);
    const b = await appointment('por_pagar', -3);
    expect(await job.runOnce()).toBe(2);
    const after = await Promise.all([statusOf(a), statusOf(b)]);
    const audits = await expiredAuditCount();
    expect(await job.runOnce()).toBe(0);
    expect(await Promise.all([statusOf(a), statusOf(b)])).toEqual(after);
    expect(await expiredAuditCount()).toBe(audits);
  });

  it('dos pasadas simultáneas no duplican la auditoría', async () => {
    const id = await appointment('por_pagar', -4);
    const results = await Promise.all([job.runOnce(), job.runOnce(), job.runOnce()]);
    expect(results.reduce((sum, n) => sum + n, 0)).toBe(1);
    const [{ n }] = await ctx.db.query(
      `SELECT count(*)::int AS n FROM audit_log WHERE entity_id = $1 AND action = 'appointment_hold_expired'`,
      [id],
    );
    expect(n).toBe(1);
  });

  it('el candado de PostgreSQL impide que otra instancia trabaje a la vez', async () => {
    const id = await appointment('por_pagar', -5);
    const other = ctx.db.createQueryRunner();
    await other.connect();
    await other.startTransaction();
    await other.query('SELECT pg_advisory_xact_lock(80801)');
    try {
      expect(await job.runOnce()).toBe(0); // otra instancia tiene el candado
      expect((await statusOf(id)).status).toBe('por_pagar');
    } finally {
      await other.rollbackTransaction();
      await other.release();
    }
    expect(await job.runOnce()).toBe(1);
  });

  it('la franja liberada vuelve a aparecer en los horarios libres', async () => {
    const cookie = await ctx.loginAsDentist();
    await ctx
      .http()
      .post('/api/v1/admin/availability-intervals')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ serviceDate: '2032-02-10', startsLocal: '08:00', endsLocal: '08:45' })
      .expect(201);
    const [row] = await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin, hold_expires_at)
       VALUES ($1, $2, '2032-02-10T12:00:00Z', '2032-02-10T12:45:00Z', 'por_pagar', 1000, 'web',
               now() + interval '5 minutes') RETURNING id`,
      [patientId, treatmentId],
    );
    const slots = async () =>
      (await ctx.http().get('/api/v1/availability/slots?date=2032-02-10').expect(200)).body.slots;
    expect(await slots()).toHaveLength(0);
    await ctx.db.query(
      `UPDATE appointment SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`,
      [row.id],
    );
    // vencida: ya se ofrece (aunque todavía no haya corrido la tarea) y la tarea la cancela
    expect(await slots()).toHaveLength(1);
    await job.runOnce();
    expect((await statusOf(row.id)).status).toBe('cancelada');
    expect(await slots()).toHaveLength(1);
  });
});
