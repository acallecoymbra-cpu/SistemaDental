import type { AdminAppointment } from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/** Agenda del dentista (T-10) con PostgreSQL real. Horas locales de La Paz (UTC-4). */
describe('agenda (T-10, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let anaId: string;
  let luisId: string;
  let treatmentId: string;
  let treatment2Id: string;
  const ids: Record<string, string> = {};

  const BASE = '/api/v1/admin/appointments';
  const get = (qs = '') => ctx.http().get(`${BASE}${qs}`).set('Cookie', cookie);

  async function insert(
    key: string,
    patientId: string,
    date: string,
    time: string,
    status: string,
    tid = treatmentId,
  ) {
    const [row] = await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin, hold_expires_at, cancel_reason)
       VALUES ($1, $2,
               ($3::date + $4::time) AT TIME ZONE 'America/La_Paz',
               ($3::date + $4::time) AT TIME ZONE 'America/La_Paz' + interval '45 minutes',
               $5::appointment_status, 1500, 'web', NULL,
               CASE WHEN $6::text = 'cancelada' THEN 'Pidió cancelar' END)
       RETURNING id`,
      [patientId, tid, date, time, status, status],
    );
    ids[key] = row.id;
  }

  const keysOf = (list: AdminAppointment[]) =>
    list.map((a) => Object.entries(ids).find(([, v]) => v === a.id)?.[0]);

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
    const mk = async (name: string, normalized: string, phone: string, guardian?: string) =>
      (
        await ctx.db.query(
          `INSERT INTO patient (full_name, normalized_name, phone, origin, birth_date, is_minor, guardian_phone)
           VALUES ($1, $2, $3, 'dentist', $4, $5, $6) RETURNING id`,
          [
            name,
            normalized,
            phone,
            guardian ? '2020-01-01' : null,
            Boolean(guardian),
            guardian ?? null,
          ],
        )
      )[0].id as string;
    anaId = await mk('Ana Pérez', 'ana perez', '70011111');
    luisId = await mk('Luis Niño', 'luis nino', '70022222', '70099999');
    const t = await ctx.db.query('SELECT id FROM treatment ORDER BY name LIMIT 2');
    treatmentId = t[0].id;
    treatment2Id = t[1].id;

    // Lunes 2033-03-07 a domingo 2033-03-13
    await insert('lun-08', anaId, '2033-03-07', '08:00', 'confirmada');
    await insert('lun-23', anaId, '2033-03-07', '23:15', 'por_pagar'); // 23:15-24:00 local
    await insert('mar-00', luisId, '2033-03-08', '00:00', 'confirmada'); // primer minuto del martes
    await insert('mar-09', luisId, '2033-03-08', '09:30', 'cancelada', treatment2Id);
    await insert('vie-10', anaId, '2033-03-11', '10:15', 'completada');
    await insert('dom-11', luisId, '2033-03-13', '11:00', 'no_asistio');
    await insert('sig-08', anaId, '2033-03-14', '08:00', 'confirmada'); // lunes siguiente
    await insert('ant-22', anaId, '2033-03-06', '22:00', 'confirmada'); // domingo anterior
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('sin sesión responde 401 (lista y detalle)', async () => {
    await ctx.http().get(BASE).expect(401);
    await ctx.http().get(`${BASE}/${ids['lun-08']}`).expect(401);
  });

  it('vista de un día: solo ese día de La Paz, ordenado, con 23:15 y 00:00 en su día', async () => {
    const lunes = (await get('?from=2033-03-07&to=2033-03-07').expect(200)).body;
    expect(keysOf(lunes)).toEqual(['lun-08', 'lun-23']);
    const martes = (await get('?from=2033-03-08&to=2033-03-08').expect(200)).body;
    expect(keysOf(martes)).toEqual(['mar-00', 'mar-09']);
  });

  it('vista de semana: de lunes a domingo, sin los vecinos', async () => {
    const semana = (await get('?from=2033-03-07&to=2033-03-13').expect(200)).body;
    expect(keysOf(semana)).toEqual(['lun-08', 'lun-23', 'mar-00', 'mar-09', 'vie-10', 'dom-11']);
  });

  it('cada consulta trae paciente, tratamiento, anticipo y comprobante (aún ninguno)', async () => {
    const [a] = (await get('?from=2033-03-08&to=2033-03-08&status=cancelada').expect(200)).body;
    expect(a).toMatchObject({
      id: ids['mar-09'],
      status: 'cancelada',
      startsAt: '2033-03-08T13:30:00.000Z',
      endsAt: '2033-03-08T14:15:00.000Z',
      depositCents: 1500,
      origin: 'web',
      holdExpiresAt: null,
      cancelReason: 'Pidió cancelar',
      paymentProof: null,
      patient: {
        fullName: 'Luis Niño',
        phone: '70022222',
        isMinor: true,
        guardianPhone: '70099999',
      },
    });
    expect(a.treatment.id).toBe(treatment2Id);
  });

  it('filtra por estado', async () => {
    const conf = (await get('?from=2033-03-07&to=2033-03-13&status=confirmada').expect(200)).body;
    expect(keysOf(conf)).toEqual(['lun-08', 'mar-00']);
    const pend = (await get('?from=2033-03-07&to=2033-03-13&status=por_pagar').expect(200)).body;
    expect(keysOf(pend)).toEqual(['lun-23']);
  });

  it('filtra por paciente: nombre sin tildes, celular y celular del apoderado', async () => {
    const range = '?from=2033-03-07&to=2033-03-13';
    expect(keysOf((await get(`${range}&patient=ANA%20PEREZ`).expect(200)).body)).toEqual([
      'lun-08',
      'lun-23',
      'vie-10',
    ]);
    expect(keysOf((await get(`${range}&patient=nino`).expect(200)).body)).toEqual([
      'mar-00',
      'mar-09',
      'dom-11',
    ]);
    expect(keysOf((await get(`${range}&patient=70011111`).expect(200)).body)).toEqual([
      'lun-08',
      'lun-23',
      'vie-10',
    ]);
    expect(keysOf((await get(`${range}&patient=70099999`).expect(200)).body)).toEqual([
      'mar-00',
      'mar-09',
      'dom-11',
    ]);
    expect((await get(`${range}&patient=zzz`).expect(200)).body).toEqual([]);
  });

  it('combina estado y paciente; un texto con símbolos de SQL no rompe ni devuelve todo', async () => {
    const both = (
      await get('?from=2033-03-07&to=2033-03-13&status=confirmada&patient=luis').expect(200)
    ).body;
    expect(keysOf(both)).toEqual(['mar-00']);
    const evil = (
      await get(
        `?from=2033-03-07&to=2033-03-13&patient=${encodeURIComponent("%_' OR 1=1 --")}`,
      ).expect(200)
    ).body;
    expect(evil).toEqual([]);
  });

  it('sin fechas usa hoy (lista vacía aquí) y un día sin consultas devuelve lista vacía', async () => {
    expect((await get().expect(200)).body).toEqual([]);
    expect((await get('?from=2033-04-01&to=2033-04-01').expect(200)).body).toEqual([]);
  });

  it('valida los parámetros (400)', async () => {
    await get('?from=07/03/2033').expect(400);
    await get('?from=2033-02-30&to=2033-03-01').expect(400);
    await get('?from=2033-03-10&to=2033-03-01').expect(400);
    await get('?from=2033-01-01&to=2033-12-31').expect(400);
    await get('?from=2033-03-07&to=2033-03-07&status=inventado').expect(400);
  });

  it('detalle: devuelve la consulta; inexistente 404 y mal formado 400', async () => {
    const res = await get(`/${ids['vie-10']}`).expect(200);
    expect(res.body).toMatchObject({ id: ids['vie-10'], status: 'completada', paymentProof: null });
    await get('/3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e').expect(404);
    await get('/no-es-un-uuid').expect(400);
  });

  it('es solo lectura: no existen POST, PATCH ni DELETE en la agenda', async () => {
    await ctx
      .http()
      .post(BASE)
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(404);
    await ctx
      .http()
      .patch(`${BASE}/${ids['lun-08']}`)
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ status: 'cancelada' })
      .expect(404);
    await ctx
      .http()
      .delete(`${BASE}/${ids['lun-08']}`)
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .expect(404);
  });
});
