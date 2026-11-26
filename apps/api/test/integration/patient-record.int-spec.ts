import type { PatientRecord } from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/** Ficha del paciente (T-14) con PostgreSQL real. Datos inventados. */
describe('ficha del paciente (T-14, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let treatmentId: string;
  let slot = 0;

  const record = (id: string) => ctx.http().get(`/api/v1/admin/patients/${id}/record`);

  async function newPatient(name: string, phone: string): Promise<string> {
    const res = await ctx
      .http()
      .post('/api/v1/admin/patients')
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ fullName: name, phone, birthDate: '1985-03-10' })
      .expect(201);
    return res.body.patient.id;
  }

  /** Inserta una cita en una franja propia (cada llamada usa la siguiente de 45 min). */
  async function appointment(
    patientId: string,
    status: string,
    startsAt?: string,
    extra: { diagnosis?: string; cost?: number } = {},
  ): Promise<string> {
    slot += 1;
    const [row] = await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin, diagnosis, cost_cents)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + interval '45 minutes', $4, 1000,
               'dentist', $5, $6)
       RETURNING id`,
      [
        patientId,
        treatmentId,
        startsAt ?? new Date(Date.UTC(2034, 0, 1, 12, slot * 45)).toISOString(),
        status,
        extra.diagnosis ?? null,
        extra.cost ?? null,
      ],
    );
    return row.id;
  }

  const openedCount = async (patientId: string) =>
    (
      await ctx.db.query(
        `SELECT count(*)::int AS n FROM audit_log
          WHERE entity_id = $1 AND action = 'patient_record_opened'`,
        [patientId],
      )
    )[0].n as number;

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
    const [t] = await ctx.db.query('SELECT id FROM treatment WHERE active = true LIMIT 1');
    treatmentId = t.id;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('sin sesión responde 401 y no audita', async () => {
    const id = await newPatient('Ficha Sin Sesion', '75100001');
    await record(id).expect(401);
    expect(await openedCount(id)).toBe(0);
  });

  it('un identificador inválido da 400 y uno que no existe da 404 (sin auditar)', async () => {
    await record('no-es-uuid').set('Cookie', cookie).expect(400);
    const missing = '3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b';
    const res = await record(missing).set('Cookie', cookie).expect(404);
    expect(res.body.message).toBe('El paciente no existe.');
    expect(await openedCount(missing)).toBe(0);
  });

  it('trae los datos del paciente y sus consultas, de la más reciente a la más antigua', async () => {
    const id = await newPatient('Ficha Completa', '75100002');
    const old = await appointment(id, 'completada', '2034-02-01T12:00:00.000Z', {
      diagnosis: 'Caries',
      cost: 15000,
    });
    const recent = await appointment(id, 'confirmada', '2034-03-01T12:00:00.000Z');
    const canceled = await appointment(id, 'cancelada', '2034-02-15T12:00:00.000Z');
    await ctx.db.query(
      `INSERT INTO payment_proof (appointment_id, receipt_number) VALUES ($1, 'FICHA-0001')`,
      [recent],
    );

    const res = await record(id).set('Cookie', cookie).expect(200);
    const body = res.body as PatientRecord;
    expect(body.patient).toMatchObject({ id, fullName: 'Ficha Completa', phone: '75100002' });
    expect(body.appointments.map((a) => a.id)).toEqual([recent, canceled, old]);
    expect(body.appointments[0]).toMatchObject({
      status: 'confirmada',
      depositCents: 1000,
      paymentProof: { receiptNumber: 'FICHA-0001', confirmed: false },
      diagnosis: null,
      costCents: null,
    });
    expect(body.appointments[2]).toMatchObject({
      status: 'completada',
      diagnosis: 'Caries',
      costCents: 15000,
      paymentProof: null,
    });
    expect(body.appointments[0]?.treatment.name).toEqual(expect.any(String));
  });

  it('solo muestra las consultas de ese paciente', async () => {
    const a = await newPatient('Ficha Uno', '75100003');
    const b = await newPatient('Ficha Dos', '75100004');
    await appointment(a, 'confirmada');
    await appointment(b, 'confirmada');
    await appointment(b, 'confirmada');
    const res = await record(a).set('Cookie', cookie).expect(200);
    expect(res.body.appointments).toHaveLength(1);
  });

  it('un paciente sin consultas devuelve la lista vacía', async () => {
    const id = await newPatient('Ficha Vacia', '75100005');
    const res = await record(id).set('Cookie', cookie).expect(200);
    expect(res.body.appointments).toEqual([]);
  });

  it('cada apertura queda auditada con el dentista, sin copiar contenido clínico ni contacto', async () => {
    const id = await newPatient('Ficha Auditada', '75100006');
    await appointment(id, 'completada', '2034-04-01T12:00:00.000Z', {
      diagnosis: 'Diagnostico Secreto',
      cost: 9900,
    });
    await record(id).set('Cookie', cookie).expect(200);
    await record(id).set('Cookie', cookie).expect(200);
    expect(await openedCount(id)).toBe(2);

    const rows = await ctx.db.query(
      `SELECT actor_kind, actor_user_id, before_json, after_json FROM audit_log
        WHERE entity_id = $1 AND action = 'patient_record_opened'`,
      [id],
    );
    for (const row of rows) {
      expect(row.actor_kind).toBe('dentist');
      expect(row.actor_user_id).toEqual(expect.any(String));
      const text = JSON.stringify(row);
      expect(text).not.toMatch(/Secreto|Auditada|75100006|9900/);
    }
  });

  it('la ficha es de solo lectura: no hay otros métodos en la ruta', async () => {
    const id = await newPatient('Ficha Lectura', '75100007');
    const url = `/api/v1/admin/patients/${id}/record`;
    const http = ctx.http();
    const attempts = [http.post(url), http.put(url), http.patch(url), http.delete(url)];
    for (const attempt of attempts) {
      const response = await attempt.set('Origin', TEST_WEB_ORIGIN).set('Cookie', cookie).send({});
      expect(response.status).toBe(404);
    }
  });
});
