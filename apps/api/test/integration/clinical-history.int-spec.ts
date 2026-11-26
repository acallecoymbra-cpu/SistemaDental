import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/** Historia clínica por versiones (T-15) con PostgreSQL real. Datos inventados. */
describe('historia clínica por versiones (T-15, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let patientId: string;

  const content = (over: object = {}) => ({
    anamnesis: 'Sin alergias conocidas.',
    dentalIndexType: 'CPO-D',
    dentalIndexValue: '3',
    diagnosis: 'Caries en 36',
    ...over,
  });
  const url = (id = patientId) => `/api/v1/admin/patients/${id}/clinical-history`;
  const save = (body: unknown, id = patientId) =>
    ctx
      .http()
      .put(url(id))
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send(body as object);
  const read = (id = patientId) => ctx.http().get(url(id)).set('Cookie', cookie);

  async function newPatient(name: string, phone: string): Promise<string> {
    const [p] = await ctx.db.query(
      `INSERT INTO patient (full_name, normalized_name, phone, origin)
       VALUES ($1, $2, $3, 'web') RETURNING id`,
      [name, name.toLowerCase(), phone],
    );
    return p.id;
  }

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
    patientId = await newPatient('Paciente Historia', '75800001');
  });
  afterAll(async () => {
    await ctx?.close();
  });

  it('exige sesión en las tres rutas y valida los datos', async () => {
    await ctx.http().get(url()).expect(401);
    await ctx.http().get(`${url()}/versions/1`).expect(401);
    await ctx.http().put(url()).set('Origin', TEST_WEB_ORIGIN).send(content()).expect(401);
    await read('no-es-uuid').expect(400);
    await read('3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b').expect(404);
    await save(content(), '3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b').expect(404);
    await save({ ...content(), anamnesis: 5 }).expect(400);
    await save({ anamnesis: 'x' }).expect(400);
    await save(content({ anamnesis: 'a'.repeat(5001) })).expect(400);
    await save(content({ diagnosis: 'a'.repeat(2001) })).expect(400);
    await save(content({ dentalIndexType: 'a'.repeat(41) })).expect(400);
  });

  it('sin historia: vigente nula y ninguna versión; guardar todo vacío no crea nada', async () => {
    const res = await read().expect(200);
    expect(res.body).toEqual({ current: null, versions: [] });
    const empty = await save(
      content({ anamnesis: ' ', dentalIndexType: '', dentalIndexValue: '', diagnosis: '\n' }),
    ).expect(200);
    expect(empty.body).toEqual({ saved: false, current: null });
  });

  it('la primera versión es la 1 y guarda quién la hizo', async () => {
    const res = await save(content({ anamnesis: '  Sin alergias conocidas.  ' })).expect(200);
    expect(res.body.saved).toBe(true);
    expect(res.body.current).toMatchObject({
      versionNumber: 1,
      anamnesis: 'Sin alergias conocidas.',
      dentalIndexType: 'CPO-D',
      diagnosis: 'Caries en 36',
    });
    expect(typeof res.body.current.createdByName).toBe('string');
  });

  it('guardar sin cambios (aunque cambien solo espacios) no crea versión', async () => {
    const res = await save(content({ diagnosis: '  Caries en 36 \r\n' })).expect(200);
    expect(res.body).toMatchObject({ saved: false, current: { versionNumber: 1 } });
    const [{ n }] = await ctx.db.query(
      'SELECT count(*)::int AS n FROM clinical_version v JOIN clinical_record r ON r.id = v.clinical_record_id WHERE r.patient_id = $1',
      [patientId],
    );
    expect(n).toBe(1);
  });

  it('un cambio crea la versión 2 y la 1 queda intacta y consultable', async () => {
    const res = await save(content({ diagnosis: 'Caries en 36 y 37' })).expect(200);
    expect(res.body).toMatchObject({ saved: true, current: { versionNumber: 2 } });

    const history = await read().expect(200);
    expect(history.body.current).toMatchObject({
      versionNumber: 2,
      diagnosis: 'Caries en 36 y 37',
    });
    expect(history.body.versions.map((v: { versionNumber: number }) => v.versionNumber)).toEqual([
      2, 1,
    ]);
    // La lista no trae contenido clínico
    expect(JSON.stringify(history.body.versions)).not.toMatch(/Caries|alergias/);

    const old = await ctx.http().get(`${url()}/versions/1`).set('Cookie', cookie).expect(200);
    expect(old.body).toMatchObject({ versionNumber: 1, diagnosis: 'Caries en 36' });
    await ctx.http().get(`${url()}/versions/9`).set('Cookie', cookie).expect(404);
    await ctx.http().get(`${url()}/versions/0`).set('Cookie', cookie).expect(404);
    await ctx.http().get(`${url()}/versions/abc`).set('Cookie', cookie).expect(400);
  });

  it('las versiones no se pueden editar ni borrar en la base (23514)', async () => {
    await expect(
      ctx.db.query(`UPDATE clinical_version SET diagnosis = 'otro' WHERE version_number = 1`),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(ctx.db.query('DELETE FROM clinical_version')).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('cada paciente tiene su historia y las versiones no se mezclan', async () => {
    const other = await newPatient('Otra Paciente', '75800002');
    expect((await read(other).expect(200)).body).toEqual({ current: null, versions: [] });
    const res = await save(content({ diagnosis: 'Gingivitis' }), other).expect(200);
    expect(res.body.current.versionNumber).toBe(1);
    expect((await read().expect(200)).body.current.diagnosis).toBe('Caries en 36 y 37');
  });

  it('guardados simultáneos con el mismo contenido crean una sola versión', async () => {
    const id = await newPatient('Paciente Carrera', '75800003');
    const results = await Promise.all(
      Array.from({ length: 5 }, () => save(content({ diagnosis: 'Carrera' }), id)),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.saved).length).toBe(1);
    const [{ n }] = await ctx.db.query(
      'SELECT count(*)::int AS n FROM clinical_version v JOIN clinical_record r ON r.id = v.clinical_record_id WHERE r.patient_id = $1',
      [id],
    );
    expect(n).toBe(1);
  });

  it('guardados simultáneos con contenido distinto se numeran sin repetir', async () => {
    const id = await newPatient('Paciente Numera', '75800004');
    const results = await Promise.all(
      [1, 2, 3, 4].map((i) => save(content({ diagnosis: `Versión ${i}` }), id)),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    const numbers = await ctx.db.query(
      `SELECT version_number FROM clinical_version v
         JOIN clinical_record r ON r.id = v.clinical_record_id
        WHERE r.patient_id = $1 ORDER BY version_number`,
      [id],
    );
    expect(numbers.map((r: { version_number: number }) => r.version_number)).toEqual([1, 2, 3, 4]);
  });

  it('audita lecturas y cambios sin copiar el contenido clínico', async () => {
    const rows = await ctx.db.query(
      `SELECT action, actor_kind, before_json, after_json FROM audit_log
        WHERE action IN ('clinical_history_read','clinical_version_read','clinical_version_created')`,
    );
    const actions = new Set(rows.map((r: { action: string }) => r.action));
    expect(actions).toEqual(
      new Set(['clinical_history_read', 'clinical_version_read', 'clinical_version_created']),
    );
    expect(rows.every((r: { actor_kind: string }) => r.actor_kind === 'dentist')).toBe(true);
    const dump = JSON.stringify(rows);
    for (const secret of ['Caries', 'alergias', 'Gingivitis', 'CPO-D']) {
      expect(dump).not.toContain(secret);
    }
  });
});
