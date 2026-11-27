'use client';

import {
  AGENDA_MAX_RANGE_DAYS,
  APPOINTMENT_STATUSES,
  formatCentsAsBs,
  parseBsToCents,
  todayInClinicTimeZone,
  type AdminAppointment,
  type AppointmentStatus,
} from '@sistema-dental/contracts';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { agendaApi } from '@/features/agenda/api';
import { RescheduleForm } from '@/features/agenda/RescheduleForm';
import {
  addDays,
  formatDayTitle,
  formatShortDate,
  formatTime,
  localDate,
  patientWhatsappLink,
  rangeFor,
  shiftDate,
  STATUS_BADGE,
  STATUS_LABEL,
  type AgendaView,
} from '@/features/agenda/dates';

const NOTIFICATION_TEXT = {
  pending: 'Correo en cola: se enviará en unos instantes.',
  sent: 'Correo enviado.',
  failed: 'No se pudo enviar el correo.',
  none: 'El paciente no tiene correo.',
} as const;

function Detail({
  item,
  onConfirm,
  confirming,
  onCancel,
  canceling,
  onReschedule,
  rescheduling,
  onNoShow,
  markingNoShow,
  onComplete,
  completing,
}: {
  item: AdminAppointment;
  onConfirm: () => void;
  confirming: boolean;
  onCancel: (reason: string) => void;
  canceling: boolean;
  onReschedule: (startsAt: string) => void;
  rescheduling: boolean;
  onNoShow: () => void;
  markingNoShow: boolean;
  onComplete: (diagnosis: string, costCents: number) => void;
  completing: boolean;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [cost, setCost] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);
  const whatsapp = patientWhatsappLink(
    item.patient,
    `Hola ${item.patient.fullName}, te escribimos del consultorio Renovando Sonrisas sobre tu consulta.`,
  );
  const canCancel = item.status === 'por_pagar' || item.status === 'confirmada';
  const canClose = item.status === 'confirmada' && new Date(item.startsAt).getTime() <= Date.now();
  const canNoShow = item.status === 'confirmada' && new Date(item.startsAt).getTime() <= Date.now();
  return (
    <dl className="card" style={{ margin: '8px 0', display: 'grid', gap: 6 }}>
      <div>
        <dt className="muted">Paciente</dt>
        <dd style={{ margin: 0 }}>
          {item.patient.fullName}
          {item.patient.isMinor ? ' (menor)' : ''} · {item.patient.phone}
          {item.patient.guardianPhone ? ` · apoderado ${item.patient.guardianPhone}` : ''}
        </dd>
      </div>
      <div>
        <dt className="muted">Anticipo</dt>
        <dd style={{ margin: 0 }}>Bs {formatCentsAsBs(item.depositCents)}</dd>
      </div>
      <div>
        <dt className="muted">Comprobante</dt>
        <dd style={{ margin: 0 }}>
          {item.paymentProof
            ? `N.º ${item.paymentProof.receiptNumber}${item.paymentProof.confirmedAt ? ' (confirmado)' : ' (por revisar)'}`
            : 'Sin comprobante'}
        </dd>
      </div>
      <div>
        <dt className="muted">Origen</dt>
        <dd style={{ margin: 0 }}>
          {item.origin === 'web' ? 'Reserva en línea' : 'Registrada por la doctora'}
        </dd>
      </div>
      {item.status === 'por_pagar' && item.paymentProof && !item.paymentProof.confirmedAt ? (
        <div>
          <button className="btn" type="button" disabled={confirming} onClick={onConfirm}>
            {confirming ? 'Confirmando…' : 'Confirmar pago'}
          </button>
        </div>
      ) : null}
      {canClose ? (
        <div>
          {closeOpen ? (
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                const cents = parseBsToCents(cost);
                if (diagnosis.trim().length === 0) {
                  setCloseError('Escribe el diagnóstico.');
                } else if (cents === null) {
                  setCloseError('Escribe el costo en bolivianos, por ejemplo 150 o 150,50.');
                } else {
                  setCloseError(null);
                  onComplete(diagnosis.trim(), cents);
                }
              }}
            >
              <div className="field">
                <label htmlFor={`diagnostico-${item.id}`}>Diagnóstico</label>
                <textarea
                  id={`diagnostico-${item.id}`}
                  rows={3}
                  maxLength={2000}
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor={`costo-${item.id}`}>Costo de la consulta (Bs)</label>
                <input
                  id={`costo-${item.id}`}
                  inputMode="decimal"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                />
                <span className="muted">Después de cerrar, la consulta queda de solo lectura.</span>
              </div>
              {closeError ? (
                <p className="alert alert-error" role="alert">
                  {closeError}
                </p>
              ) : null}
              <div className="btn-row">
                <button className="btn" type="submit" disabled={completing}>
                  {completing ? 'Cerrando…' : 'Cerrar consulta'}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setCloseOpen(false)}
                >
                  Volver
                </button>
              </div>
            </form>
          ) : (
            <button className="btn" type="button" onClick={() => setCloseOpen(true)}>
              Cerrar consulta
            </button>
          )}
        </div>
      ) : null}
      {item.status === 'completada' ? (
        <>
          <div>
            <dt className="muted">Diagnóstico</dt>
            <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.diagnosis}</dd>
          </div>
          <div>
            <dt className="muted">Costo</dt>
            <dd style={{ margin: 0 }}>
              {item.costCents === null ? '—' : `Bs ${formatCentsAsBs(item.costCents)}`}
            </dd>
          </div>
        </>
      ) : null}
      {canNoShow ? (
        <div>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={markingNoShow}
            onClick={onNoShow}
          >
            {markingNoShow ? 'Marcando…' : 'Marcar no asistió'}
          </button>
          <span className="muted"> El anticipo se retiene.</span>
        </div>
      ) : null}
      {canCancel ? (
        <div>
          {moveOpen ? (
            <RescheduleForm
              item={item}
              busy={rescheduling}
              onSubmit={onReschedule}
              onClose={() => setMoveOpen(false)}
            />
          ) : (
            <button className="btn btn-secondary" type="button" onClick={() => setMoveOpen(true)}>
              Reprogramar
            </button>
          )}
        </div>
      ) : null}
      {canCancel ? (
        <div>
          {cancelOpen ? (
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                onCancel(reason);
              }}
            >
              <div className="field">
                <label htmlFor={`motivo-${item.id}`}>Motivo de la cancelación</label>
                <textarea
                  id={`motivo-${item.id}`}
                  value={reason}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setReason(event.target.value)}
                />
                <span className="muted">
                  Es solo para la clínica: no se envía al paciente. El anticipo no se devuelve.
                </span>
              </div>
              <div className="btn-row">
                <button className="btn btn-danger" type="submit" disabled={canceling}>
                  {canceling ? 'Cancelando…' : 'Confirmar cancelación'}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setCancelOpen(false)}
                >
                  Volver
                </button>
              </div>
            </form>
          ) : (
            <button className="btn btn-secondary" type="button" onClick={() => setCancelOpen(true)}>
              Cancelar consulta
            </button>
          )}
        </div>
      ) : null}
      {item.status === 'cancelada' && item.cancelNotification ? (
        <div>
          <dt className="muted">Aviso al paciente</dt>
          <dd style={{ margin: 0 }}>
            {NOTIFICATION_TEXT[item.cancelNotification]}
            {item.cancelNotification !== 'sent' && whatsapp ? (
              <>
                {' '}
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  Avisar por WhatsApp
                </a>
              </>
            ) : null}
          </dd>
        </div>
      ) : null}
      {item.cancelReason ? (
        <div>
          <dt className="muted">Motivo de cancelación</dt>
          <dd style={{ margin: 0 }}>{item.cancelReason}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * Agenda del dentista (T-10): consultas por día o por semana, con filtros por estado y
 * paciente, y el detalle de cada una (anticipo, comprobante). Solo lectura.
 */
export default function AgendaPage() {
  const [view, setView] = useState<AgendaView>('dia');
  const [date, setDate] = useState(todayInClinicTimeZone());
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [patientInput, setPatientInput] = useState('');
  const [patient, setPatient] = useState('');
  const [items, setItems] = useState<AdminAppointment[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [noShowId, setNoShowId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const range = useMemo(() => {
    if (review) {
      const today = todayInClinicTimeZone();
      return { from: today, to: addDays(today, AGENDA_MAX_RANGE_DAYS - 1) };
    }
    return rangeFor(view, date);
  }, [view, date, review]);

  const load = useCallback(async () => {
    setItems(null);
    try {
      setItems(await agendaApi.list({ ...range, status, patient, review }));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [range, status, patient, review]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(() => {
    const groups = new Map<string, AdminAppointment[]>();
    for (const item of items ?? []) {
      const day = localDate(item.startsAt);
      groups.set(day, [...(groups.get(day) ?? []), item]);
    }
    return [...groups.entries()];
  }, [items]);

  async function handleConfirm(item: AdminAppointment) {
    setConfirmingId(item.id);
    setNotice(null);
    try {
      await agendaApi.confirmPayment(item.id);
      setNotice(`Pago confirmado: ${item.patient.fullName}.`);
      setOpenId(null);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleCancel(item: AdminAppointment, reason: string) {
    setCancelingId(item.id);
    setNotice(null);
    try {
      const result = await agendaApi.cancel(item.id, reason.trim());
      setNotice(
        result.notice === 'queued'
          ? `Consulta cancelada: ${item.patient.fullName}. Se enviará un aviso a su correo.`
          : `Consulta cancelada: ${item.patient.fullName}. No tiene correo: avísale por WhatsApp.`,
      );
      setError(null);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setCancelingId(null);
    }
  }

  async function handleReschedule(item: AdminAppointment, startsAt: string) {
    setMovingId(item.id);
    setNotice(null);
    try {
      const moved = await agendaApi.reschedule(item.id, startsAt);
      setNotice(
        `Consulta reprogramada: ${item.patient.fullName} ahora el ${formatShortDate(localDate(moved.startsAt))} a las ${formatTime(moved.startsAt)}.`,
      );
      setError(null);
      setOpenId(null);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setMovingId(null);
    }
  }

  async function handleNoShow(item: AdminAppointment) {
    setNoShowId(item.id);
    setNotice(null);
    try {
      await agendaApi.noShow(item.id);
      setNotice(`Marcada como no asistió: ${item.patient.fullName}.`);
      setError(null);
      setOpenId(null);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setNoShowId(null);
    }
  }

  async function handleComplete(item: AdminAppointment, diagnosis: string, costCents: number) {
    setCompletingId(item.id);
    setNotice(null);
    try {
      await agendaApi.complete(item.id, { diagnosis, costCents });
      setNotice(`Consulta cerrada: ${item.patient.fullName}.`);
      setError(null);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setCompletingId(null);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPatient(patientInput.trim());
  }

  const title = review
    ? 'Pagos por confirmar'
    : view === 'dia'
      ? formatDayTitle(range.from)
      : `Semana del ${formatShortDate(range.from)} al ${formatShortDate(range.to)}`;

  return (
    <>
      <h1>Agenda</h1>

      <section className="section card" aria-label="Filtros de la agenda">
        <div className="form">
          <div className="btn-row" role="group" aria-label="Vista">
            <button
              type="button"
              className={view === 'dia' ? 'btn' : 'btn btn-secondary'}
              aria-pressed={view === 'dia'}
              onClick={() => setView('dia')}
            >
              Día
            </button>
            <button
              type="button"
              className={view === 'semana' ? 'btn' : 'btn btn-secondary'}
              aria-pressed={view === 'semana'}
              onClick={() => setView('semana')}
            >
              Semana
            </button>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDate(shiftDate(view, date, -1))}
            >
              {view === 'dia' ? 'Día anterior' : 'Semana anterior'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDate(todayInClinicTimeZone())}
            >
              Hoy
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDate(shiftDate(view, date, 1))}
            >
              {view === 'dia' ? 'Día siguiente' : 'Semana siguiente'}
            </button>
          </div>
          <div className="field">
            <label htmlFor="agenda-fecha">Fecha</label>
            <input
              id="agenda-fecha"
              type="date"
              value={date}
              onChange={(event) => event.target.value && setDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={review}
                onChange={(event) => setReview(event.target.checked)}
              />{' '}
              Solo por confirmar (próximos 2 meses)
            </label>
          </div>
          <div className="field">
            <label htmlFor="agenda-estado">Estado</label>
            <select
              id="agenda-estado"
              value={status}
              onChange={(event) => setStatus(event.target.value as AppointmentStatus | '')}
            >
              <option value="">Todos</option>
              {APPOINTMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <form className="form" onSubmit={handleSearch} role="search" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="agenda-paciente">Paciente (nombre o celular)</label>
            <input
              id="agenda-paciente"
              value={patientInput}
              maxLength={120}
              onChange={(event) => setPatientInput(event.target.value)}
            />
          </div>
          <div className="btn-row">
            <button className="btn" type="submit">
              Buscar
            </button>
            {patient ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setPatientInput('');
                  setPatient('');
                }}
              >
                Quitar filtro de paciente
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <h2>{title}</h2>
      {notice ? (
        <p className="alert alert-success" role="status">
          {notice}
        </p>
      ) : null}
      <ErrorAlert error={error} />
      {items === null && !error ? <p className="muted">Cargando…</p> : null}
      {items && items.length === 0 ? (
        <p className="muted">No hay consultas en este período con esos filtros.</p>
      ) : null}
      {byDay.map(([day, list]) => (
        <section key={day} className="section" aria-label={formatDayTitle(day)}>
          {view === 'semana' || review ? <h3>{formatDayTitle(day)}</h3> : null}
          <table className="table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Paciente</th>
                <th>Tratamiento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id}>
                  <td data-label="Hora">{formatTime(item.startsAt)}</td>
                  <td data-label="Paciente">
                    {item.patient.fullName}
                    {item.patient.isMinor ? (
                      <>
                        {' '}
                        <span className="badge badge-off">Menor</span>
                      </>
                    ) : null}
                  </td>
                  <td data-label="Tratamiento">{item.treatment.name}</td>
                  <td data-label="Estado">
                    <span className={STATUS_BADGE[item.status]}>{STATUS_LABEL[item.status]}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      aria-expanded={openId === item.id}
                      onClick={() => setOpenId(openId === item.id ? null : item.id)}
                    >
                      {openId === item.id ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                    {openId === item.id ? (
                      <Detail
                        item={item}
                        confirming={confirmingId === item.id}
                        onConfirm={() => void handleConfirm(item)}
                        canceling={cancelingId === item.id}
                        onCancel={(reason) => void handleCancel(item, reason)}
                        rescheduling={movingId === item.id}
                        onReschedule={(startsAt) => void handleReschedule(item, startsAt)}
                        markingNoShow={noShowId === item.id}
                        onNoShow={() => void handleNoShow(item)}
                        completing={completingId === item.id}
                        onComplete={(diagnosis, cost) => void handleComplete(item, diagnosis, cost)}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
