'use client';

import {
  PATIENT_GIVEN_NAMES_MAX_LENGTH,
  PATIENT_SURNAME_MAX_LENGTH,
  formatCentsAsBs,
  type PhoneDialCode,
  type PublicAppointmentSummary,
} from '@sistema-dental/contracts';
import { useId, useState, type FormEvent } from 'react';
import { PhoneInput } from '@/components/PhoneInput';
import styles from '@/app/portal.module.css';
import { STATUS_LABEL } from '@/features/agenda/dates';
import { formatAppointmentTime } from '@/features/booking/api';
import { ApiError } from '@/lib/api-client';
import { lookupApi } from './api';

/**
 * Mis consultas (T-09, V-27): primer nombre + primer apellido + celular con su país (el del
 * apoderado si es menor). Los mensajes de error
 * vienen de la API y son genéricos a propósito: no dicen qué dato falló.
 */
export function LookupFlow({ whatsapp }: { whatsapp: string | null }) {
  const id = useId();
  const [items, setItems] = useState<PublicAppointmentSummary[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setErrors([]);
    setItems(null);
    try {
      setItems(
        await lookupApi.find({
          firstName: String(form.get('firstName') ?? '').trim(),
          firstSurname: String(form.get('firstSurname') ?? '').trim(),
          phoneCountryCode: String(form.get('phoneCountryCode') ?? '591') as PhoneDialCode,
          phone: String(form.get('phone') ?? '').trim(),
        }),
      );
    } catch (error) {
      setErrors(error instanceof ApiError ? error.messages : ['Ocurrió un error inesperado.']);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        {errors.length > 0 ? (
          <div className={styles.errorBox} role="alert">
            {errors.map((message) => (
              <p key={message} style={{ margin: 0 }}>
                {message}
              </p>
            ))}
            {whatsapp ? (
              <p style={{ margin: '8px 0 0' }}>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  Escribir por WhatsApp
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
        <section className={styles.stepCard} aria-labelledby={`${id}-datos`}>
          <h2 id={`${id}-datos`}>Tus datos</h2>
          <div className={styles.fieldGroup}>
            <label htmlFor={`${id}-name`}>Nombre</label>
            <input
              id={`${id}-name`}
              name="firstName"
              autoComplete="given-name"
              maxLength={PATIENT_GIVEN_NAMES_MAX_LENGTH}
            />
            <span className={styles.hint}>Basta con tu primer nombre.</span>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor={`${id}-surname`}>Primer apellido</label>
            <input
              id={`${id}-surname`}
              name="firstSurname"
              autoComplete="family-name"
              maxLength={PATIENT_SURNAME_MAX_LENGTH}
            />
          </div>
          <PhoneInput
            id={`${id}-phone`}
            name="phone"
            label="Celular"
            fieldClassName={styles.fieldGroup}
            hintClassName={styles.hint}
            hint="Si la consulta es de un menor de edad, escribe su nombre y el celular de su apoderado."
          />
          <button type="submit" className={styles.button} disabled={sending}>
            {sending ? 'Buscando…' : 'Ver mis consultas'}
          </button>
        </section>
      </form>

      {items ? (
        <section aria-labelledby={`${id}-lista`} className={styles.stepCard}>
          <h2 id={`${id}-lista`}>Tus consultas</h2>
          <ul className={styles.slots} style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
            {items.map((item) => (
              <li key={`${item.startsAt}-${item.status}`} className={styles.summary}>
                <strong>{formatAppointmentTime(item.startsAt)}</strong>
                <span>{item.treatmentName}</span>
                <span>
                  {STATUS_LABEL[item.status]}
                  {item.status === 'por_pagar'
                    ? item.paymentReceived
                      ? ' · comprobante recibido, falta la confirmación de la doctora'
                      : ' · falta enviar el comprobante'
                    : ''}
                </span>
                <span>Anticipo: Bs {formatCentsAsBs(item.depositCents)}</span>
              </li>
            ))}
          </ul>
          <p className={styles.hint}>
            Para cambiar o cancelar una consulta, escríbenos por WhatsApp.
          </p>
        </section>
      ) : null}
    </>
  );
}
