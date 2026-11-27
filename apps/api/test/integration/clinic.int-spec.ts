import type { ClinicSettings, PublicClinicInfo } from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/**
 * Pruebas de integración de la configuración de la clínica (T-01, PostgreSQL real).
 * La tabla tiene una sola fila (la crea la migración); cada prueba parte de su valor inicial.
 */
describe('configuración de la clínica (T-01, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;

  const ADMIN = '/api/v1/admin/clinic-settings';

  const admin = () => ({
    get: () => ctx.http().get(ADMIN).set('Cookie', cookie),
    patch: (body: object) =>
      ctx.http().patch(ADMIN).set('Origin', TEST_WEB_ORIGIN).set('Cookie', cookie).send(body),
  });

  /** Deja la fila como la dejó la migración: 30 Bs, anticipo 10 Bs, sin QR ni WhatsApp. */
  async function resetSettings() {
    await ctx.db.query(
      `UPDATE clinic_settings
       SET consultation_price_cents = 3000, deposit_cents = 1000,
           payment_qr_ref = NULL, whatsapp_phone = NULL, updated_by = NULL`,
    );
  }

  /** audit_log es solo de inserción: cada prueba mira solo lo que se agregó desde que empezó. */
  let auditBaseline = 0;

  async function allAuditRows() {
    return ctx.db.query(
      `SELECT action, before_json, after_json FROM audit_log
       WHERE entity_type = 'clinic_settings' ORDER BY occurred_at`,
    );
  }

  async function auditRows() {
    return (await allAuditRows()).slice(auditBaseline);
  }

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
  });

  beforeEach(async () => {
    await resetSettings();
    auditBaseline = (await allAuditRows()).length;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('portal público', () => {
    it('muestra precio, anticipo y WhatsApp sin necesitar sesión', async () => {
      const res = await ctx.http().get('/api/v1/clinic').expect(200);
      expect(res.body).toEqual({
        consultationPriceCents: 3000,
        depositCents: 1000,
        whatsappPhone: null,
      } satisfies PublicClinicInfo);
    });

    it('nunca expone la referencia del QR', async () => {
      await admin()
        .patch({ paymentQrRef: 'https://ejemplo.test/qr.png', whatsappPhone: '+59170000000' })
        .expect(200);
      const res = await ctx.http().get('/api/v1/clinic').expect(200);
      expect(Object.keys(res.body).sort()).toEqual([
        'consultationPriceCents',
        'depositCents',
        'whatsappPhone',
      ]);
      expect(res.body.whatsappPhone).toBe('+59170000000');
    });
  });

  describe('panel del dentista', () => {
    it('sin sesión responde 401', async () => {
      await ctx.http().get(ADMIN).expect(401);
      await ctx.http().patch(ADMIN).set('Origin', TEST_WEB_ORIGIN).send({}).expect(401);
    });

    it('devuelve la configuración completa', async () => {
      const res = await admin().get().expect(200);
      expect(res.body).toMatchObject({
        consultationPriceCents: 3000,
        depositCents: 1000,
        currency: 'BOB',
        paymentQrRef: null,
        whatsappPhone: null,
      });
    });

    it('no ofrece crear ni borrar (una sola fila)', async () => {
      await ctx.http().post(ADMIN).set('Origin', TEST_WEB_ORIGIN).set('Cookie', cookie).expect(404);
      await ctx
        .http()
        .delete(ADMIN)
        .set('Origin', TEST_WEB_ORIGIN)
        .set('Cookie', cookie)
        .expect(404);
    });
  });

  describe('anticipo', () => {
    it('acepta el anticipo dentro de 10 a 20 Bs y deja auditoría con antes y después', async () => {
      const res = await admin().patch({ depositCents: 1500 }).expect(200);
      expect((res.body as ClinicSettings).depositCents).toBe(1500);

      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe('clinic_settings_updated');
      expect(rows[0].before_json.depositCents).toBe(1000);
      expect(rows[0].after_json.depositCents).toBe(1500);
    });

    it('acepta exactamente 10 y 20 Bs', async () => {
      await admin().patch({ depositCents: 1000 }).expect(200);
      await admin().patch({ depositCents: 2000 }).expect(200);
    });

    it('rechaza 9,99 y 20,01 Bs (400)', async () => {
      const low = await admin().patch({ depositCents: 999 }).expect(400);
      expect(low.body.message).toBe('El anticipo debe estar entre 10 y 20 Bs.');
      await admin().patch({ depositCents: 2001 }).expect(400);
      // no cambió nada
      const res = await admin().get();
      expect(res.body.depositCents).toBe(1000);
      expect(await auditRows()).toHaveLength(0);
    });

    it('el anticipo no puede ser mayor que el precio (400)', async () => {
      await admin().patch({ consultationPriceCents: 1500, depositCents: 1500 }).expect(200);
      const res = await admin().patch({ consultationPriceCents: 1400 }).expect(400);
      expect(res.body.message).toBe('El anticipo no puede ser mayor que el precio de la consulta.');
      await admin().patch({ depositCents: 1600 }).expect(400);
    });

    it('la base también lo impide, sin pasar por la API', async () => {
      await expect(
        ctx.db.query('UPDATE clinic_settings SET deposit_cents = 999'),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
      await expect(
        ctx.db.query('UPDATE clinic_settings SET deposit_cents = 2001'),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
    });
  });

  describe('precio, QR y WhatsApp', () => {
    it('cambia el precio de la consulta', async () => {
      const res = await admin().patch({ consultationPriceCents: 3500 }).expect(200);
      expect(res.body.consultationPriceCents).toBe(3500);
    });

    it('guarda QR y WhatsApp; un texto vacío los deja en null', async () => {
      const set = await admin()
        .patch({ paymentQrRef: '  https://ejemplo.test/qr.png  ', whatsappPhone: '+59170000000' })
        .expect(200);
      expect(set.body).toMatchObject({
        paymentQrRef: 'https://ejemplo.test/qr.png',
        whatsappPhone: '+59170000000',
      });
      const cleared = await admin().patch({ paymentQrRef: '   ', whatsappPhone: '' }).expect(200);
      expect(cleared.body).toMatchObject({ paymentQrRef: null, whatsappPhone: null });
    });

    it('rechaza un WhatsApp con formato inválido (400)', async () => {
      await admin().patch({ whatsappPhone: 'abc' }).expect(400);
      await admin().patch({ whatsappPhone: '123' }).expect(400);
      await admin().patch({ whatsappPhone: '7000-0000' }).expect(400);
      // sin código de país, o con un número que no es válido para su país
      await admin().patch({ whatsappPhone: '79000000' }).expect(400);
      const res = await admin().patch({ whatsappPhone: '+5917900000' }).expect(400);
      expect(res.body.message).toBe('El WhatsApp no es válido para el país elegido.');
      await admin().patch({ whatsappPhone: '+59179000000' }).expect(200);
      await admin().patch({ whatsappPhone: '+5491123456789' }).expect(200);
      // más de 15 dígitos en total (límite internacional E.164): 400, nunca 500
      await admin().patch({ whatsappPhone: '+5512345678901234' }).expect(400);
    });
  });

  describe('validación del cuerpo', () => {
    it('rechaza importes que no son enteros o son inválidos (400)', async () => {
      await admin().patch({ depositCents: 15.5 }).expect(400);
      await admin().patch({ depositCents: '1500' }).expect(400);
      await admin().patch({ consultationPriceCents: 0 }).expect(400);
      await admin().patch({ consultationPriceCents: -100 }).expect(400);
      await admin().patch({ consultationPriceCents: 1e12 }).expect(400);
    });

    it('rechaza campos que no existen (400)', async () => {
      await admin().patch({ currency: 'USD' }).expect(400);
      await admin().patch({ depositCents: 1500, descuento: 5 }).expect(400);
    });

    it('un cambio vacío o igual no registra auditoría', async () => {
      await admin().patch({}).expect(200);
      await admin().patch({ depositCents: 1000 }).expect(200);
      expect(await auditRows()).toHaveLength(0);
    });
  });

  describe('una sola fila', () => {
    it('la base impide crear una segunda fila', async () => {
      await expect(
        ctx.db.query(
          `INSERT INTO clinic_settings (consultation_price_cents, deposit_cents) VALUES (3000, 1500)`,
        ),
      ).rejects.toMatchObject({ driverError: { code: '23505' } });
    });
  });
});
