import { EmailOutboxService } from '../../src/appointments/email-outbox.service';
import { MailError, Mailer, type MailMessage } from '../../src/mail/mailer';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';

/** Cancelar y avisar (T-13) con PostgreSQL real. Datos inventados. */
describe('cancelar consulta y avisar (T-13, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let treatmentId: string;
  let withEmail: string;
  let withoutEmail: string;
  let slot = 0;

  const cancel = (id: string, reason: unknown = 'A pedido del paciente', withCookie = true) => {
    const req = ctx
      .http()
      .post(`/api/v1/admin/appointments/${id}/cancel`)
      .set('Origin', TEST_WEB_ORIGIN);
    return (withCookie ? req.set('Cookie', cookie) : req).send({ reason });
  };

  async function appointment(patientId: string, status = 'confirmada'): Promise<string> {
    slot += 1;
    const [row] = await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + interval '45 minutes', $4, 1000, 'web')
       RETURNING id`,
      [patientId, treatmentId, new Date(Date.UTC(2037, 0, 1, 12, slot * 45)).toISOString(), status],
    );
    return row.id;
  }

  const row = async (id: string) =>
    (await ctx.db.query('SELECT * FROM appointment WHERE id = $1', [id]))[0];
  const notification = async (id: string) =>
    (await ctx.db.query('SELECT * FROM email_notification WHERE appointment_id = $1', [id]))[0];

  /** Hace que el aviso venza ahora para que la siguiente pasada lo tome. */
  const makeDue = (id: string) =>
    ctx.db.query(
      `UPDATE email_notification SET next_attempt_at = now() - interval '1 second'
        WHERE appointment_id = $1 AND delivery_status = 'pending'`,
      [id],
    );

  let sendSpy: jest.SpyInstance<Promise<void>, [MailMessage]>;
  const outbox = () => ctx.app.get(EmailOutboxService);

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
    const [t] = await ctx.db.query('SELECT id FROM treatment WHERE active = true LIMIT 1');
    treatmentId = t.id;
    const [a] = await ctx.db.query(
      `INSERT INTO patient (full_name, normalized_name, phone, email, origin)
       VALUES ('Paciente Con Correo', 'paciente con correo', '75600001', 'con@ejemplo.test', 'web')
       RETURNING id`,
    );
    const [b] = await ctx.db.query(
      `INSERT INTO patient (full_name, normalized_name, phone, origin)
       VALUES ('Paciente Sin Correo', 'paciente sin correo', '75600002', 'dentist') RETURNING id`,
    );
    withEmail = a.id;
    withoutEmail = b.id;
  });

  beforeEach(() => {
    sendSpy = jest.spyOn(ctx.app.get(Mailer), 'send').mockResolvedValue(undefined);
  });

  afterEach(() => {
    sendSpy.mockRestore();
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('sin sesión 401; id inválido 400; inexistente 404', async () => {
    const id = await appointment(withEmail);
    await cancel(id, 'x', false).expect(401);
    expect((await row(id)).status).toBe('confirmada');
    await cancel('no-es-uuid').expect(400);
    await cancel('3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b').expect(404);
  });

  it('el motivo es obligatorio y tiene tope', async () => {
    const id = await appointment(withEmail);
    for (const bad of ['', '   ', 123, null, 'x'.repeat(501)]) {
      await cancel(id, bad).expect(400);
    }
    expect((await row(id)).status).toBe('confirmada');
  });

  it('cancela una confirmada: motivo, quién y cuándo, sin devolver el anticipo, y audita', async () => {
    const id = await appointment(withEmail);
    const res = await cancel(id, '  Pidió cancelar por WhatsApp ').expect(200);
    expect(res.body.appointment).toMatchObject({
      id,
      status: 'cancelada',
      cancelReason: 'Pidió cancelar por WhatsApp',
      cancelNotification: 'pending',
    });
    const saved = await row(id);
    expect(saved).toMatchObject({ status: 'cancelada', refunded: 'no' });
    expect(saved.canceled_at).toBeInstanceOf(Date);
    const [dentist] = await ctx.db.query('SELECT id FROM dentist_user WHERE active = true LIMIT 1');
    expect(saved.canceled_by).toBe(dentist.id);

    const [audit] = await ctx.db.query(
      `SELECT actor_kind, before_json, after_json FROM audit_log
        WHERE entity_id = $1 AND action = 'appointment_canceled'`,
      [id],
    );
    expect(audit).toMatchObject({
      actor_kind: 'dentist',
      before_json: { status: 'confirmada' },
      after_json: { status: 'cancelada' },
    });
    expect(JSON.stringify(audit)).not.toContain('WhatsApp');
  });

  it('también cancela una por pagar', async () => {
    const id = await appointment(withEmail, 'por_pagar');
    await cancel(id).expect(200);
    expect((await row(id)).status).toBe('cancelada');
  });

  it('la franja queda libre: otra consulta puede ocupar esa hora', async () => {
    const id = await appointment(withEmail);
    const { starts_at: startsAt } = await row(id);
    await expect(
      ctx.db.query(
        `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                  deposit_cents, origin)
         VALUES ($1, $2, $3, $3::timestamptz + interval '45 minutes', 'confirmada', 1000, 'web')`,
        [withoutEmail, treatmentId, startsAt],
      ),
    ).rejects.toMatchObject({ code: '23P01' }); // ocupada mientras estaba confirmada
    await cancel(id).expect(200);
    await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin)
       VALUES ($1, $2, $3, $3::timestamptz + interval '45 minutes', 'confirmada', 1000, 'web')`,
      [withoutEmail, treatmentId, startsAt],
    );
  });

  it('las consultas que ya terminaron o ya están canceladas no se pueden cancelar', async () => {
    for (const status of ['completada', 'no_asistio', 'cancelada']) {
      const id = await appointment(withEmail, status);
      const res = await cancel(id).expect(409);
      expect(res.body.message).toMatch(/ya no se puede cancelar/);
      expect((await row(id)).status).toBe(status);
    }
  });

  it('con correo: el aviso entra a la cola; sin correo: lo indica y no encola nada', async () => {
    const a = await appointment(withEmail);
    const resA = await cancel(a).expect(200);
    expect(resA.body.notice).toBe('queued');
    expect(await notification(a)).toMatchObject({
      recipient_email: 'con@ejemplo.test',
      kind: 'appointment_canceled',
      delivery_status: 'pending',
      attempts: 0,
    });

    const b = await appointment(withoutEmail);
    const resB = await cancel(b).expect(200);
    expect(resB.body.notice).toBe('no_email');
    expect(resB.body.appointment.cancelNotification).toBe('none');
    expect(await notification(b)).toBeUndefined();
  });

  it('la agenda solo muestra el estado del aviso en las canceladas', async () => {
    const id = await appointment(withEmail);
    const before = await ctx
      .http()
      .get(`/api/v1/admin/appointments/${id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(before.body.cancelNotification).toBeNull();
  });

  it('envía el aviso sin el motivo ni datos clínicos, y queda como enviado', async () => {
    const id = await appointment(withEmail);
    await cancel(id, 'Motivo Interno Reservado').expect(200);
    await makeDue(id);
    expect(await outbox().processDue()).toBeGreaterThanOrEqual(1);
    const message = sendSpy.mock.calls.find((c) => c[0].to === 'con@ejemplo.test')![0];
    expect(message.subject).toMatch(/cancelada/);
    expect(message.text).toContain('Paciente Con Correo');
    expect(message.text).not.toContain('Motivo Interno Reservado');
    const saved = await notification(id);
    expect(saved).toMatchObject({ delivery_status: 'sent', attempts: 1, last_error_code: null });
    expect(saved.sent_at).toBeInstanceOf(Date);
    const res = await ctx
      .http()
      .get(`/api/v1/admin/appointments/${id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.cancelNotification).toBe('sent');
  });

  it('es idempotente: una segunda pasada no vuelve a enviar lo ya enviado', async () => {
    const id = await appointment(withEmail);
    await cancel(id).expect(200);
    await makeDue(id);
    await outbox().processDue();
    const calls = sendSpy.mock.calls.length;
    await outbox().processDue();
    expect(sendSpy.mock.calls.length).toBe(calls);
    expect((await notification(id)).attempts).toBe(1);
  });

  it('si el correo falla, reintenta hasta 3 veces en total y luego queda fallido, sin deshacer la cancelación', async () => {
    const id = await appointment(withEmail);
    sendSpy.mockRejectedValue(new MailError('smtp_down', 'detalle interno con datos@ejemplo.test'));
    await cancel(id).expect(200); // la cancelación no depende del correo

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await makeDue(id);
      await outbox().processDue();
      const saved = await notification(id);
      expect(saved.attempts).toBe(attempt);
      expect(saved.last_error_code).toBe('smtp_down');
      expect(saved.delivery_status).toBe(attempt < 3 ? 'pending' : 'failed');
    }
    // Un 4.º intento no existe: ya está fallido
    await makeDue(id);
    await outbox().processDue();
    expect((await notification(id)).attempts).toBe(3);
    expect((await row(id)).status).toBe('cancelada');
    // No se guarda el detalle del error, solo el código
    expect(JSON.stringify(await notification(id))).not.toContain('datos@ejemplo.test');

    const res = await ctx
      .http()
      .get(`/api/v1/admin/appointments/${id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.cancelNotification).toBe('failed');
  });

  it('entre reintentos espera: un aviso cuyo próximo intento es futuro no se toca', async () => {
    const id = await appointment(withEmail);
    sendSpy.mockRejectedValue(new MailError('smtp_down', 'x'));
    await cancel(id).expect(200);
    await makeDue(id);
    await outbox().processDue();
    const calls = sendSpy.mock.calls.length;
    await outbox().processDue(); // todavía no toca el 2.º intento
    expect(sendSpy.mock.calls.length).toBe(calls);
    const saved = await notification(id);
    expect(new Date(saved.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('si el aviso sale bien en el 2.º intento, queda enviado', async () => {
    const id = await appointment(withEmail);
    sendSpy.mockRejectedValueOnce(new MailError('smtp_down', 'x')).mockResolvedValue(undefined);
    await cancel(id).expect(200);
    await makeDue(id);
    await outbox().processDue();
    await makeDue(id);
    await outbox().processDue();
    expect(await notification(id)).toMatchObject({ delivery_status: 'sent', attempts: 2 });
  });

  it('sin proveedor de correo configurado NO finge enviar: queda fallido con código claro', async () => {
    sendSpy.mockRestore(); // usa el enviador real por defecto
    const id = await appointment(withEmail);
    await cancel(id).expect(200);
    for (let i = 0; i < 3; i += 1) {
      await makeDue(id);
      await outbox().processDue();
    }
    expect(await notification(id)).toMatchObject({
      delivery_status: 'failed',
      attempts: 3,
      last_error_code: 'mail_not_configured',
    });
  });

  it('cuatro cancelaciones a la vez: una gana, las otras reciben 409 y hay un solo aviso', async () => {
    const id = await appointment(withEmail);
    const results = await Promise.all(Array.from({ length: 4 }, () => cancel(id)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409]);
    const [{ n }] = await ctx.db.query(
      'SELECT count(*)::int AS n FROM email_notification WHERE appointment_id = $1',
      [id],
    );
    expect(n).toBe(1);
  });

  it('una cancelada no se puede reabrir ni modificar (estado final)', async () => {
    const id = await appointment(withEmail);
    await cancel(id).expect(200);
    await expect(
      ctx.db.query(`UPDATE appointment SET status = 'confirmada' WHERE id = $1`, [id]),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
