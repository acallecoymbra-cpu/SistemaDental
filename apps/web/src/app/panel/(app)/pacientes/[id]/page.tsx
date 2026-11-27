'use client';

import { formatCentsAsBs, type PatientRecord } from '@sistema-dental/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import {
  formatShortDate,
  formatTime,
  localDate,
  STATUS_BADGE,
  STATUS_LABEL,
} from '@/features/agenda/dates';
import { formatBirthDate, formatPhone, patientsApi } from '@/features/patients/api';
import { ClinicalHistoryPanel } from '@/features/patients/ClinicalHistoryPanel';

/**
 * Ficha del paciente (T-14): contacto y consultas en una sola pantalla. Cada vez que se abre
 * queda registrada en la auditoría (sin copiar el contenido). La historia clínica por versiones
 * vive en `ClinicalHistoryPanel` (T-15).
 */
export default function PatientRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    patientsApi
      .record(id)
      .then((result) => active && setRecord(result))
      .catch((err: unknown) => active && setError(err));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <>
      <p>
        <Link href="/panel/pacientes">← Volver a pacientes</Link>
      </p>
      <ErrorAlert error={error} />
      {!record && !error ? <p className="muted">Cargando…</p> : null}
      {record ? (
        <>
          <h1>
            {record.patient.fullName}{' '}
            {record.patient.isMinor ? <span className="badge badge-off">Menor</span> : null}
          </h1>

          <section className="section card" aria-labelledby="contacto">
            <h2 id="contacto">Datos de contacto</h2>
            <dl style={{ display: 'grid', gap: 6, margin: 0 }}>
              <div>
                <dt className="muted">CI</dt>
                <dd style={{ margin: 0 }}>{record.patient.ci ?? '—'}</dd>
              </div>
              <div>
                <dt className="muted">Celular</dt>
                <dd style={{ margin: 0 }}>
                  {formatPhone(record.patient.phoneCountryCode, record.patient.phone)}
                </dd>
              </div>
              <div>
                <dt className="muted">Correo</dt>
                <dd style={{ margin: 0 }}>{record.patient.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="muted">Fecha de nacimiento</dt>
                <dd style={{ margin: 0 }}>{formatBirthDate(record.patient.birthDate)}</dd>
              </div>
              <div>
                <dt className="muted">Celular del apoderado</dt>
                <dd style={{ margin: 0 }}>
                  {record.patient.guardianPhone
                    ? formatPhone(
                        record.patient.guardianPhoneCountryCode,
                        record.patient.guardianPhone,
                      )
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="muted">Registrado</dt>
                <dd style={{ margin: 0 }}>
                  {record.patient.origin === 'web' ? 'Desde el portal' : 'Por la doctora'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="section" aria-labelledby="consultas">
            <h2 id="consultas">Consultas</h2>
            {record.appointments.length === 0 ? (
              <p className="muted">Este paciente aún no tiene consultas.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Tratamiento</th>
                    <th>Estado</th>
                    <th>Anticipo</th>
                    <th>Comprobante</th>
                    <th>Diagnóstico y costo</th>
                  </tr>
                </thead>
                <tbody>
                  {record.appointments.map((a) => (
                    <tr key={a.id}>
                      <td data-label="Fecha">{formatShortDate(localDate(a.startsAt))}</td>
                      <td data-label="Hora">{formatTime(a.startsAt)}</td>
                      <td data-label="Tratamiento">{a.treatment.name}</td>
                      <td data-label="Estado">
                        <span className={STATUS_BADGE[a.status]}>{STATUS_LABEL[a.status]}</span>
                        {a.cancelReason ? (
                          <>
                            <br />
                            <span className="muted">{a.cancelReason}</span>
                          </>
                        ) : null}
                      </td>
                      <td data-label="Anticipo">Bs {formatCentsAsBs(a.depositCents)}</td>
                      <td data-label="Comprobante">
                        {a.paymentProof
                          ? `${a.paymentProof.receiptNumber}${a.paymentProof.confirmed ? ' (confirmado)' : ' (por revisar)'}`
                          : '—'}
                      </td>
                      <td data-label="Diagnóstico y costo">
                        {a.diagnosis ? a.diagnosis : '—'}
                        {a.costCents !== null ? ` · Bs ${formatCentsAsBs(a.costCents)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <ClinicalHistoryPanel patientId={id} />
        </>
      ) : null}
    </>
  );
}
