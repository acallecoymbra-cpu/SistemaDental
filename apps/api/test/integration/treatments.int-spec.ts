import type { AdminTreatment, PublicTreatment } from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/**
 * Molde de pruebas de integración (B-05). Cada módulo nuevo debería probar, como mínimo:
 * - rutas públicas: qué datos expone y cuáles NO;
 * - rutas del panel: 401 sin sesión, y el caso feliz con sesión;
 * - validaciones (400), no encontrado (404), duplicados (409);
 * - que cada escritura deja su registro de auditoría.
 */
describe('tratamientos (B-05, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;

  const admin = () => ({
    get: () => ctx.http().get('/api/v1/admin/treatments').set('Cookie', cookie),
    post: (body: object) =>
      ctx
        .http()
        .post('/api/v1/admin/treatments')
        .set('Origin', TEST_WEB_ORIGIN)
        .set('Cookie', cookie)
        .send(body),
    patch: (id: string, body: object) =>
      ctx
        .http()
        .patch(`/api/v1/admin/treatments/${id}`)
        .set('Origin', TEST_WEB_ORIGIN)
        .set('Cookie', cookie)
        .send(body),
  });

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('portal público', () => {
    it('lista los siete tratamientos de la semilla sin necesitar sesión', async () => {
      const res = await ctx.http().get('/api/v1/treatments').expect(200);
      const names = (res.body as PublicTreatment[]).map((t) => t.name);
      expect(names).toHaveLength(7);
      expect(names).toEqual(expect.arrayContaining(['Limpieza', 'Cirugía de terceros molares']));
    });

    it('expone solo id, nombre y descripción', async () => {
      const res = await ctx.http().get('/api/v1/treatments').expect(200);
      expect(Object.keys(res.body[0]).sort()).toEqual(['description', 'id', 'name']);
    });
  });

  describe('panel del dentista', () => {
    it('sin sesión responde 401', async () => {
      await ctx.http().get('/api/v1/admin/treatments').expect(401);
      await ctx
        .http()
        .post('/api/v1/admin/treatments')
        .set('Origin', TEST_WEB_ORIGIN)
        .send({ name: 'X' })
        .expect(401);
    });

    it('crea un tratamiento y queda en auditoría', async () => {
      const res = await admin()
        .post({ name: '  Ortodoncia  ', description: 'Brackets metálicos' })
        .expect(201);
      const created = res.body as AdminTreatment;
      expect(created).toMatchObject({
        name: 'Ortodoncia',
        description: 'Brackets metálicos',
        active: true,
      });

      const [row] = await ctx.db.query(
        `SELECT action, after_json FROM audit_log WHERE entity_type = 'treatment' AND entity_id = $1`,
        [created.id],
      );
      expect(row.action).toBe('treatment_created');
      expect(row.after_json).toMatchObject({ name: 'Ortodoncia' });
    });

    it('rechaza nombres duplicados sin distinguir mayúsculas (409)', async () => {
      const res = await admin().post({ name: 'LIMPIEZA' }).expect(409);
      expect(res.body.message).toBe('Ya existe un tratamiento con ese nombre.');
    });

    it('valida el cuerpo (400)', async () => {
      await admin().post({ name: '   ' }).expect(400);
      await admin()
        .post({ name: 'x'.repeat(81) })
        .expect(400);
      await admin().post({ name: 'Válido', precio: 10 }).expect(400);
    });

    it('desactivar lo oculta del portal pero no lo borra', async () => {
      const list = (await admin().get().expect(200)).body as AdminTreatment[];
      const target = list.find((t) => t.name === 'Blanqueamiento')!;

      await admin().patch(target.id, { active: false }).expect(200);

      const publicNames = (
        (await ctx.http().get('/api/v1/treatments')).body as PublicTreatment[]
      ).map((t) => t.name);
      expect(publicNames).not.toContain('Blanqueamiento');
      const adminNames = ((await admin().get()).body as AdminTreatment[]).map((t) => t.name);
      expect(adminNames).toContain('Blanqueamiento');

      const [row] = await ctx.db.query(
        `SELECT before_json, after_json FROM audit_log
         WHERE entity_id = $1 AND action = 'treatment_updated'`,
        [target.id],
      );
      expect(row.before_json.active).toBe(true);
      expect(row.after_json.active).toBe(false);
    });

    it('edita nombre y descripción; una descripción vacía queda en null', async () => {
      const list = (await admin().get()).body as AdminTreatment[];
      const target = list.find((t) => t.name === 'Exodoncia')!;
      const res = await admin()
        .patch(target.id, { name: 'Exodoncia simple', description: '   ' })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Exodoncia simple', description: null });
    });

    it('un id inexistente da 404 y uno mal formado da 400', async () => {
      await admin().patch('3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', { active: false }).expect(404);
      await admin().patch('no-es-un-uuid', { active: false }).expect(400);
    });

    it('no ofrece borrar (no existe DELETE)', async () => {
      const list = (await admin().get()).body as AdminTreatment[];
      await ctx
        .http()
        .delete(`/api/v1/admin/treatments/${list[0]!.id}`)
        .set('Origin', TEST_WEB_ORIGIN)
        .set('Cookie', cookie)
        .expect(404);
    });
  });
});
