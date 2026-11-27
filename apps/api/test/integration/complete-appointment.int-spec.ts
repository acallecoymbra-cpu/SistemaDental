import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';
import { insertPatient } from './patient-fixtures';

/** Cerrar consulta (T-17) con PostgreSQL real. Datos inventados. */
describe('cerrar consulta (T-17, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let treatmentId: string;
  let patientId: string;

  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const valid = { diagnosis: 'Caries tratada en pieza 36', costCents: 15000 };

  const complete = (id: string, body: unknown = valid, withCookie = true) => {
    const req = ctx
      .http()
      .post(`/api/v1/admin/appointments/${id}/complete`)
      .set('Origin', TEST_WEB_ORIGIN);
    return (withCookie ? req.set('Cookie', cookie) : req).send(body as object);
  };

  async function appointment(startsAt: string, status = 'confirmada'): Promise<string> {
    const [row] = await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + interval '45 minutes', $4, 1000, 'web')
       RETURNING id`,
      [patientId, treatmentId, startsAt, status],
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
    const p = {
      id: await insertPatient(ctx.db, {
        givenNames: 'Paciente',
        firstSurname: 'Cierra',
        phone: '75900001',
        origin: 'web',
      }),
    };
    patientId = p.id;
  });
  afterAll(async () => {
    await ctx?.close();
  });

  it('sin sesión 401; id inválido 400; inexistente 404', async () => {
    const id = await appointment(hoursAgo(30));
    await complete(id, valid, false).expect(401);
    await complete('no-es-uuid').expect(400);
    await complete('3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b').expect(404);
    expect((await row(id)).status).toBe('confirmada');
  });

  it('exige diagnóstico y un costo válido (≥ 0, entero)', async () => {
    const id = await appointment(hoursAgo(31));
    const bad: unknown[] = [
      {},
      { costCents: 100 },
      { diagnosis: 'ok' },
      { diagnosis: '   ', costCents: 100 },
      { diagnosis: 5, costCents: 100 },
      { diagnosis: 'a'.repeat(2001), costCents: 100 },
      { diagnosis: 'ok', costCents: -1 },
      { diagnosis: 'ok', costCents: 10.5 },
      { diagnosis: 'ok', costCents: '100' },
      { diagnosis: 'ok', costCents: null },
      { diagnosis: 'ok', costCents: 1_000_000_000 },
    ];
    for (const body of bad) {
      await complete(id, body).expect(400);
    }
    expect((await row(id)).status).toBe('confirmada');
  });

  it('cierra una confirmada cuya hora ya pasó: guarda diagnóstico y costo, y audita sin copiar el diagnóstico', async () => {
    const id = await appointment(hoursAgo(32));
    const res = await complete(id, { diagnosis: '  Obturación en 46  ', costCents: 20000 }).expect(
      200,
    );
    expect(res.body).toMatchObject({
      id,
      status: 'completada',
      diagnosis: 'Obturación en 46',
      costCents: 20000,
    });
    const saved = await row(id);
    expect(saved).toMatchObject({ status: 'completada', diagnosis: 'Obturación en 46' });
    expect(Number(saved.cost_cents)).toBe(20000);
    expect(saved.completed_at).toBeInstanceOf(Date);
    expect(saved.completed_by).toEqual(expect.any(String));
    const [audit] = await ctx.db.query(
      `SELECT actor_kind, before_json, after_json FROM audit_log
        WHERE entity_id = $1 AND action = 'appointment_completed'`,
      [id],
    );
    expect(audit).toMatchObject({
      actor_kind: 'dentist',
      before_json: { status: 'confirmada' },
      after_json: { status: 'completada', costCents: 20000 },
    });
    expect(JSON.stringify(audit)).not.toContain('Obturación');
  });

  it('el costo puede ser 0', async () => {
    const id = await appointment(hoursAgo(33));
    const res = await complete(id, { diagnosis: 'Control sin costo', costCents: 0 }).expect(200);
    expect(res.body.costCents).toBe(0);
  });

  it('después queda de solo lectura: ni la API ni la base permiten cambiarla', async () => {
    const id = await appointment(hoursAgo(34));
    await complete(id).expect(200);
    await complete(id, { diagnosis: 'Otro', costCents: 1 }).expect(409);
    await ctx
      .http()
      .post(`/api/v1/admin/appointments/${id}/cancel`)
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ reason: 'x' })
      .expect(409);
    await ctx
      .http()
      .post(`/api/v1/admin/appointments/${id}/no-show`)
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(409);
    await expect(
      ctx.db.query(`UPDATE appointment SET diagnosis = 'cambio' WHERE id = $1`, [id]),
    ).rejects.toMatchObject({ code: '23514' });
    expect((await row(id)).diagnosis).toBe('Caries tratada en pieza 36');
  });

  it('antes de la hora de la consulta no se puede', async () => {
    const future = new Date(Date.now() + 3 * 3_600_000).toISOString();
    const id = await appointment(future);
    const res = await complete(id).expect(409);
    expect(res.body.message).toMatch(/Todavía no llegó la hora/);
    expect((await row(id)).status).toBe('confirmada');
  });

  it('solo desde confirmada: por pagar, cancelada y no asistió dan 409', async () => {
    let offset = 40;
    for (const status of ['por_pagar', 'cancelada', 'no_asistio']) {
      const id = await appointment(hoursAgo(offset++), status);
      const res = await complete(id).expect(409);
      expect(res.body.message).toMatch(/Solo una consulta confirmada/);
      expect((await row(id)).status).toBe(status);
    }
  });

  it('cierres simultáneos: uno gana y los demás reciben 409', async () => {
    const id = await appointment(hoursAgo(50));
    const results = await Promise.all(Array.from({ length: 4 }, () => complete(id)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409]);
  });

  it('el diagnóstico y el costo aparecen en la agenda y en la ficha del paciente', async () => {
    const id = await appointment(hoursAgo(51));
    await complete(id, { diagnosis: 'Limpieza profunda', costCents: 12345 }).expect(200);
    const record = await ctx
      .http()
      .get(`/api/v1/admin/patients/${patientId}/record`)
      .set('Cookie', cookie)
      .expect(200);
    const item = record.body.appointments.find((a: { id: string }) => a.id === id);
    expect(item).toMatchObject({ diagnosis: 'Limpieza profunda', costCents: 12345 });
  });
});
