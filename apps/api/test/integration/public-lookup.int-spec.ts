import { normalizePatientName } from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/** «Mis consultas» (T-09) con PostgreSQL real, incluido el límite de intentos. Datos inventados. */
describe('mis consultas (T-09, PostgreSQL real)', () => {
  let ctx: TestApp;
  let treatmentId: string;
  let slot = 0;

  const GENERIC = 'No encontramos consultas con esos datos. Revisa tu nombre y tu celular.';

  const lookup = (fullName: unknown, phone: unknown) =>
    ctx.http().post('/api/v1/appointments/lookup').set('Origin', TEST_WEB_ORIGIN).send({
      fullName,
      phone,
    });

  async function patient(
    name: string,
    phone: string,
    extra: { guardian?: string; birth?: string } = {},
  ): Promise<string> {
    const [row] = await ctx.db.query(
      `INSERT INTO patient (full_name, normalized_name, phone, origin, birth_date, is_minor,
                            guardian_phone)
       VALUES ($1, $6, $2, 'web', $3, $4, $5) RETURNING id`,
      [
        name,
        phone,
        extra.birth ?? '1990-01-01',
        Boolean(extra.guardian),
        extra.guardian ?? null,
        normalizePatientName(name),
      ],
    );
    return row.id;
  }

  async function appointment(
    patientId: string,
    status = 'confirmada',
    extra: { diagnosis?: string; cost?: number } = {},
  ): Promise<void> {
    slot += 1;
    await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin, diagnosis, cost_cents)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + interval '45 minutes', $4, 1500,
               'dentist', $5, $6)`,
      [
        patientId,
        treatmentId,
        new Date(Date.UTC(2035, 0, 1, 12, slot * 45)).toISOString(),
        status,
        extra.diagnosis ?? null,
        extra.cost ?? null,
      ],
    );
  }

  const attempts = async () =>
    (await ctx.db.query('SELECT * FROM public_lookup_attempt ORDER BY attempted_at')) as {
      origin_hash: string;
      successful: boolean;
      blocked_until: Date | null;
    }[];

  const failUntilBlocked = async () => {
    for (let i = 0; i < 5; i += 1) {
      await lookup('Nadie Existe', '70000000').expect(404);
    }
  };

  beforeAll(async () => {
    ctx = await startTestApp();
    const [t] = await ctx.db.query('SELECT id FROM treatment WHERE active = true LIMIT 1');
    treatmentId = t.id;
  });

  beforeEach(async () => {
    await ctx.db.query('DELETE FROM public_lookup_attempt');
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('es público: con nombre y celular devuelve solo lo mínimo de cada consulta', async () => {
    const id = await patient('Maria Consulta', '76300001');
    await appointment(id, 'completada', { diagnosis: 'Diagnostico Secreto', cost: 12345 });
    await appointment(id, 'por_pagar');
    const res = await lookup('Maria Consulta', '76300001').expect(200);
    expect(res.body).toHaveLength(2);
    // Más reciente primero y solo estos campos: nada clínico, ni ids, ni datos personales
    expect(Object.keys(res.body[0]).sort()).toEqual([
      'depositCents',
      'endsAt',
      'paymentReceived',
      'startsAt',
      'status',
      'treatmentName',
    ]);
    expect(res.body[0]).toMatchObject({ status: 'por_pagar', depositCents: 1500 });
    expect(JSON.stringify(res.body)).not.toMatch(/Secreto|12345|76300001|Maria/);
  });

  it('reconoce el nombre sin importar mayúsculas ni tildes, y el celular con o sin 591', async () => {
    const id = await patient('Jose Peña', '76300002');
    await ctx.db.query(`UPDATE patient SET normalized_name = 'jose pena' WHERE id = $1`, [id]);
    await appointment(id);
    await lookup('  JOSÉ   PEÑA ', '+591 7630-0002').expect(200);
  });

  it('indica si el paciente ya envió su comprobante', async () => {
    const id = await patient('Pago Enviado', '76300003');
    await appointment(id, 'por_pagar');
    const [a] = await ctx.db.query('SELECT id FROM appointment WHERE patient_id = $1', [id]);
    await ctx.db.query(
      `INSERT INTO payment_proof (appointment_id, receipt_number) VALUES ($1, 'LOOK-0001')`,
      [a.id],
    );
    const res = await lookup('Pago Enviado', '76300003').expect(200);
    expect(res.body[0].paymentReceived).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('LOOK-0001');
  });

  it('un menor se consulta con su nombre y el celular de su apoderado', async () => {
    const id = await patient('Nino Consulta', '76300004', {
      guardian: '76300005',
      birth: '2020-06-01',
    });
    await appointment(id);
    const res = await lookup('Nino Consulta', '76300005').expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('no mezcla datos de otras personas con el mismo celular', async () => {
    const a = await patient('Comparte Uno', '76300006');
    const b = await patient('Comparte Dos', '76300006');
    await appointment(a);
    await appointment(b);
    await appointment(b);
    expect((await lookup('Comparte Uno', '76300006').expect(200)).body).toHaveLength(1);
    expect((await lookup('Comparte Dos', '76300006').expect(200)).body).toHaveLength(2);
  });

  it('los errores son genéricos: nombre inexistente, celular equivocado y sin consultas dicen lo mismo', async () => {
    const withAppointments = await patient('Existe Conmigo', '76300007');
    await appointment(withAppointments);
    await patient('Existe Sin Consultas', '76300008');
    const messages = [
      (await lookup('Nombre Inventado', '76300007').expect(404)).body.message,
      (await lookup('Existe Conmigo', '76399999').expect(404)).body.message,
      (await lookup('Existe Sin Consultas', '76300008').expect(404)).body.message,
    ];
    expect(new Set(messages)).toEqual(new Set([GENERIC]));
  });

  it('valida el formato sin contar como intento fallido', async () => {
    for (const [name, phone] of [
      ['', '76300009'],
      ['Alguien', ''],
      [123, '76300009'],
      ['Alguien', null],
    ]) {
      await lookup(name, phone).expect(400);
    }
    expect(await attempts()).toHaveLength(0);
  });

  it('con 5 intentos fallidos bloquea: el 6.º ya no consulta, ni con datos correctos', async () => {
    const id = await patient('Bloqueado Real', '76300010');
    await appointment(id);
    await failUntilBlocked();
    const rows = await attempts();
    expect(rows.filter((r) => !r.successful)).toHaveLength(5);
    const blockedUntil = rows[4]!.blocked_until!;
    const minutes = (blockedUntil.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);

    const res = await lookup('Bloqueado Real', '76300010').expect(429);
    expect(res.body.message).toMatch(/Demasiados intentos/);
    expect(res.body.message).toMatch(/15 minutos/);
    // Mientras dura el bloqueo no se registran más intentos ni se extiende
    expect(await attempts()).toHaveLength(5);

    const [audit] = await ctx.db.query(
      `SELECT actor_kind, entity_id, after_json FROM audit_log WHERE action = 'public_lookup_blocked'`,
    );
    expect(audit).toMatchObject({ actor_kind: 'anonymous', entity_id: null });
  });

  it('pasados los 15 minutos vuelve a funcionar', async () => {
    const id = await patient('Desbloqueado Real', '76300011');
    await appointment(id);
    await failUntilBlocked();
    await lookup('Desbloqueado Real', '76300011').expect(429);
    await ctx.db.query(
      `UPDATE public_lookup_attempt SET blocked_until = now() - interval '1 second'`,
    );
    await lookup('Desbloqueado Real', '76300011').expect(200);
  });

  it('los fallos de hace más de 10 minutos no cuentan', async () => {
    const [probe] = await ctx.db.query(`SELECT 1 FROM public_lookup_attempt LIMIT 1`);
    expect(probe).toBeUndefined();
    await lookup('Nadie Existe', '70000000').expect(404);
    const origin = (await attempts())[0]!.origin_hash;
    await ctx.db.query('DELETE FROM public_lookup_attempt');
    for (let i = 0; i < 4; i += 1) {
      await ctx.db.query(
        `INSERT INTO public_lookup_attempt (origin_hash, successful, attempted_at)
         VALUES ($1, false, now() - interval '11 minutes')`,
        [origin],
      );
    }
    await lookup('Nadie Existe', '70000000').expect(404);
    await lookup('Nadie Existe', '70000000').expect(404); // 2.º fallo reciente: sigue sin bloquear
    expect((await attempts()).filter((r) => r.blocked_until)).toHaveLength(0);
  });

  it('los aciertos no cuentan como fallos', async () => {
    const id = await patient('Acierta Siempre', '76300012');
    await appointment(id);
    for (let i = 0; i < 8; i += 1) {
      await lookup('Acierta Siempre', '76300012').expect(200);
    }
    await lookup('Nadie Existe', '70000000').expect(404);
  });

  it('el bloqueo de otro origen no afecta a este', async () => {
    const id = await patient('Origen Distinto', '76300013');
    await appointment(id);
    await ctx.db.query(
      `INSERT INTO public_lookup_attempt (origin_hash, successful, blocked_until)
       VALUES (repeat('a', 64), false, now() + interval '10 minutes')`,
    );
    await lookup('Origen Distinto', '76300013').expect(200);
  });

  it('varios intentos fallidos a la vez no se saltan el límite', async () => {
    const results = await Promise.all(
      Array.from({ length: 9 }, () => lookup('Nadie Existe', '70000000')),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 404)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(4);
  });

  it('guarda solo un hash del origen y borra los intentos de hace más de un día', async () => {
    await ctx.db.query(
      `INSERT INTO public_lookup_attempt (origin_hash, successful, attempted_at)
       VALUES (repeat('b', 64), false, now() - interval '25 hours')`,
    );
    await lookup('Nadie Existe', '70000000').expect(404);
    const rows = await attempts();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.origin_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.origin_hash).not.toMatch(/127\.0\.0\.1/);
  });
});
