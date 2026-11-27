import {
  todayInClinicTimeZone,
  type AvailabilityInterval,
  type AvailableSlotsResponse,
} from '@sistema-dental/contracts';
import { startTestApp, TEST_WEB_ORIGIN, type TestApp } from './helpers';
import { insertPatient } from './patient-fixtures';

/**
 * Citas (restricciones de la base) y horarios libres (T-03), con PostgreSQL real.
 * También prueba la regla de T-02: no dejar fuera una cita confirmada.
 */
describe('citas y horarios libres (T-03, PostgreSQL real)', () => {
  let ctx: TestApp;
  let cookie: string;
  let patientId: string;
  let treatmentId: string;

  const INTERVALS = '/api/v1/admin/availability-intervals';
  const SLOTS = '/api/v1/availability/slots';

  async function interval(serviceDate: string, startsLocal: string, endsLocal: string) {
    const res = await ctx
      .http()
      .post(INTERVALS)
      .set('Origin', TEST_WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ serviceDate, startsLocal, endsLocal })
      .expect(201);
    return res.body as AvailabilityInterval;
  }

  async function slots(date: string): Promise<AvailableSlotsResponse> {
    return (await ctx.http().get(`${SLOTS}?date=${date}`).expect(200)).body;
  }

  const hours = (r: AvailableSlotsResponse) => r.slots.map((s) => s.startsLocal);

  /** Inserta una cita directamente (la API de reservas llega en T-06). Hora local de La Paz. */
  async function appointment(
    date: string,
    time: string,
    status: string,
    holdMinutesFromNow: number | null = null,
  ) {
    await ctx.db.query(
      `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                deposit_cents, origin, hold_expires_at)
       VALUES ($1, $2,
               ($3::date + $4::time) AT TIME ZONE 'America/La_Paz',
               ($3::date + $4::time) AT TIME ZONE 'America/La_Paz' + interval '45 minutes',
               $5, 1000, 'web',
               CASE WHEN $6::int IS NULL THEN NULL ELSE now() + make_interval(mins => $6::int) END)`,
      [patientId, treatmentId, date, time, status, holdMinutesFromNow],
    );
  }

  function addDays(days: number): string {
    const [y, m, d] = todayInClinicTimeZone().split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
  }

  beforeAll(async () => {
    ctx = await startTestApp();
    cookie = await ctx.loginAsDentist();
    const patient = {
      id: await insertPatient(ctx.db, {
        givenNames: 'Paciente',
        firstSurname: 'Citas',
        phone: '70900001',
        origin: 'dentist',
      }),
    };
    patientId = patient.id;
    const [treatment] = await ctx.db.query('SELECT id FROM treatment LIMIT 1');
    treatmentId = treatment.id;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('restricciones de la tabla de citas', () => {
    it('dos citas que ocupan franja no se superponen (23P01), aunque sea parcial', async () => {
      await appointment('2031-01-10', '09:00', 'confirmada');
      await expect(appointment('2031-01-10', '09:00', 'por_pagar')).rejects.toMatchObject({
        driverError: { code: '23P01' },
      });
      // 09:30 se superpone con 09:00-09:45
      await expect(appointment('2031-01-10', '09:30', 'confirmada')).rejects.toMatchObject({
        driverError: { code: '23P01' },
      });
      // 09:45 queda justo después: permitido
      await appointment('2031-01-10', '09:45', 'confirmada');
    });

    it('una cita cancelada no ocupa franja', async () => {
      await appointment('2031-01-11', '09:00', 'cancelada');
      await appointment('2031-01-11', '09:00', 'por_pagar', 8);
    });

    it('la franja dura exactamente 45 minutos', async () => {
      await expect(
        ctx.db.query(
          `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                    deposit_cents, origin)
           VALUES ($1, $2, '2031-02-01T14:00:00Z', '2031-02-01T15:00:00Z', 'confirmada', 1000, 'web')`,
          [patientId, treatmentId],
        ),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
    });

    it('un estado final no se puede modificar', async () => {
      await appointment('2031-01-12', '09:00', 'cancelada');
      await expect(
        ctx.db.query(
          `UPDATE appointment SET cancel_reason = 'x'
            WHERE starts_at = ('2031-01-12'::date + time '09:00') AT TIME ZONE 'America/La_Paz'`,
        ),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
    });
  });

  describe('horarios libres', () => {
    it('es público (sin sesión) y valida la fecha', async () => {
      await ctx.http().get(`${SLOTS}?date=2031-03-01`).expect(200);
      await ctx.http().get(SLOTS).expect(400);
      await ctx.http().get(`${SLOTS}?date=01/03/2031`).expect(400);
      await ctx.http().get(`${SLOTS}?date=2031-02-30`).expect(400);
    });

    it('sin intervalos no hay franjas', async () => {
      expect((await slots('2031-03-02')).slots).toEqual([]);
    });

    it('un intervalo se divide en franjas de 45 min y la última cabe completa', async () => {
      await interval('2031-03-03', '08:00', '12:00');
      // 08:00, 08:45, 09:30, 10:15, 11:00 (11:45 ya no cabe antes de las 12:00)
      expect(hours(await slots('2031-03-03'))).toEqual([
        '08:00',
        '08:45',
        '09:30',
        '10:15',
        '11:00',
      ]);
    });

    it('un intervalo de exactamente 45 min da una franja; uno de 89 min también', async () => {
      await interval('2031-03-04', '08:00', '08:45');
      expect(hours(await slots('2031-03-04'))).toEqual(['08:00']);
      await interval('2031-03-05', '08:00', '09:29');
      expect(hours(await slots('2031-03-05'))).toEqual(['08:00']);
    });

    it('varios intervalos del mismo día se suman, ordenados', async () => {
      await interval('2031-03-06', '15:00', '15:45');
      await interval('2031-03-06', '08:00', '08:45');
      expect(hours(await slots('2031-03-06'))).toEqual(['08:00', '15:00']);
    });

    it('devuelve el instante en UTC correcto para La Paz (UTC-4)', async () => {
      const res = await slots('2031-03-03');
      expect(res.slots[0]).toEqual({ startsAt: '2031-03-03T12:00:00.000Z', startsLocal: '08:00' });
    });

    it('cambio de día: la franja de las 23:00 de La Paz cae al día siguiente en UTC', async () => {
      await interval('2031-03-07', '23:00', '23:59');
      const res = await slots('2031-03-07');
      expect(res.slots).toEqual([{ startsAt: '2031-03-08T03:00:00.000Z', startsLocal: '23:00' }]);
    });

    it('oculta franjas con cita confirmada, completada, no asistió o reserva vigente', async () => {
      await interval('2031-04-01', '08:00', '12:00');
      await appointment('2031-04-01', '08:00', 'confirmada');
      await appointment('2031-04-01', '08:45', 'completada');
      await appointment('2031-04-01', '09:30', 'no_asistio');
      await appointment('2031-04-01', '10:15', 'por_pagar', 5);
      expect(hours(await slots('2031-04-01'))).toEqual(['11:00']);
    });

    it('una reserva vencida y una cancelada liberan su franja', async () => {
      await interval('2031-04-02', '08:00', '09:30');
      await appointment('2031-04-02', '08:00', 'por_pagar', -1); // vencida
      await appointment('2031-04-02', '08:45', 'cancelada');
      expect(hours(await slots('2031-04-02'))).toEqual(['08:00', '08:45']);
    });

    it('una cita que se superpone parcialmente con la grilla también oculta la franja', async () => {
      await interval('2031-04-03', '08:00', '09:30');
      await appointment('2031-04-03', '08:30', 'confirmada'); // 08:30-09:15
      expect(hours(await slots('2031-04-03'))).toEqual([]);
    });

    it('hoy y fechas pasadas no se ofrecen; mañana sí', async () => {
      const today = addDays(0);
      const tomorrow = addDays(1);
      await interval(today, '08:00', '12:00');
      await interval(tomorrow, '08:00', '12:00');
      expect((await slots(today)).slots).toEqual([]);
      expect((await slots('2020-01-01')).slots).toEqual([]);
      expect((await slots(tomorrow)).slots.length).toBe(5);
    });
  });

  describe('T-02: no dejar fuera una cita confirmada', () => {
    const admin = (id: string) => `${INTERVALS}/${id}`;
    const patch = (id: string, body: object) =>
      ctx.http().patch(admin(id)).set('Origin', TEST_WEB_ORIGIN).set('Cookie', cookie).send(body);

    it('rechaza reducir el intervalo si la cita confirmada queda fuera (409)', async () => {
      const iv = await interval('2031-05-01', '08:00', '12:00');
      await appointment('2031-05-01', '11:00', 'confirmada');
      const res = await patch(iv.id, { endsLocal: '11:00' }).expect(409);
      expect(res.body.message).toMatch(/consulta confirmada/);
      // dejar la cita justo dentro (termina 11:45) sí se permite
      await patch(iv.id, { endsLocal: '11:45' }).expect(200);
    });

    it('rechaza mover el intervalo de fecha y eliminarlo con cita confirmada', async () => {
      const iv = await interval('2031-05-02', '08:00', '12:00');
      await appointment('2031-05-02', '08:00', 'confirmada');
      await patch(iv.id, { serviceDate: '2031-05-03' }).expect(409);
      await ctx
        .http()
        .delete(admin(iv.id))
        .set('Origin', TEST_WEB_ORIGIN)
        .set('Cookie', cookie)
        .expect(409);
    });

    it('permite cambiar o eliminar si solo hay citas por pagar o canceladas', async () => {
      const iv = await interval('2031-05-04', '08:00', '12:00');
      await appointment('2031-05-04', '08:00', 'por_pagar', 5);
      await appointment('2031-05-04', '08:45', 'cancelada');
      await patch(iv.id, { endsLocal: '08:45' }).expect(200);
      await ctx
        .http()
        .delete(admin(iv.id))
        .set('Origin', TEST_WEB_ORIGIN)
        .set('Cookie', cookie)
        .expect(204);
    });

    it('una cita confirmada en otro intervalo no estorba', async () => {
      const a = await interval('2031-05-05', '08:00', '09:00');
      await interval('2031-05-05', '14:00', '15:00');
      await appointment('2031-05-05', '14:00', 'confirmada');
      await patch(a.id, { endsLocal: '08:45' }).expect(200);
    });
  });
});
