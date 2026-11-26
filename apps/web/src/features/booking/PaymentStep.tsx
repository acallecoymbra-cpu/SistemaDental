'use client';

import { formatCentsAsBs, type PublicBooking } from '@sistema-dental/contracts';
import { useEffect, useId, useState, type FormEvent } from 'react';
import styles from '@/app/portal.module.css';
import { whatsappLink } from '@/features/portal/whatsapp';
import { ApiError } from '@/lib/api-client';
import {
  bookingApi,
  formatAppointmentTime,
  formatCountdown,
  isImageRef,
  secondsUntil,
} from './api';

const WHATSAPP_MESSAGE = 'Hola, tuve un problema con el pago de mi reserva de consulta.';

function WhatsappHelp({ phone }: { phone: string | null }) {
  const href = whatsappLink(phone, WHATSAPP_MESSAGE);
  return href ? (
    <a className={styles.buttonOutline} href={href} target="_blank" rel="noopener noreferrer">
      Escribir por WhatsApp
    </a>
  ) : null;
}

/**
 * Paso de pago (T-07): el QR, el monto, el contador de 8 minutos y el número de comprobante.
 * La consulta sigue «por pagar» hasta que la doctora confirme el pago.
 */
export function PaymentStep({ booking }: { booking: PublicBooking }) {
  const id = useId();
  const [left, setLeft] = useState(() => secondsUntil(booking.holdExpiresAt));
  const [receipt, setReceipt] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (sent) return;
    const timer = setInterval(() => setLeft(secondsUntil(booking.holdExpiresAt)), 1000);
    return () => clearInterval(timer);
  }, [booking.holdExpiresAt, sent]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = receipt.trim();
    if (!value) {
      setErrors(['Escribe el número de comprobante.']);
      return;
    }
    setSending(true);
    setErrors([]);
    try {
      await bookingApi.sendProof(booking.id, value);
      setSent(true);
    } catch (error) {
      setErrors(error instanceof ApiError ? error.messages : ['Ocurrió un error inesperado.']);
    } finally {
      setSending(false);
    }
  }

  const summary = (
    <dl className={styles.summary}>
      <dt>TRATAMIENTO</dt>
      <dd>{booking.treatmentName}</dd>
      <dt>FECHA Y HORA</dt>
      <dd>{formatAppointmentTime(booking.startsAt)}</dd>
      <dt>ANTICIPO</dt>
      <dd>Bs {formatCentsAsBs(booking.depositCents)}</dd>
    </dl>
  );

  if (sent) {
    return (
      <section className={styles.success} aria-labelledby={`${id}-sent`} role="status">
        <h2 id={`${id}-sent`} className={styles.sectionTitle}>
          Recibimos tu comprobante
        </h2>
        <p>
          La doctora revisará tu pago y confirmará tu consulta. Tu horario sigue apartado mientras
          tanto.
        </p>
        {summary}
      </section>
    );
  }

  if (left <= 0) {
    return (
      <section className={styles.success} aria-labelledby={`${id}-late`}>
        <h2 id={`${id}-late`} className={styles.sectionTitle}>
          La reserva venció
        </h2>
        <p role="alert" className={styles.errorBox}>
          Pasaron los 8 minutos y el horario volvió a estar libre. Si ya pagaste, escríbenos por
          WhatsApp para ayudarte.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a className={styles.button} href="/reservar">
            Reservar de nuevo
          </a>
          <WhatsappHelp phone={booking.whatsappPhone} />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.success} aria-labelledby={`${id}-ok`} role="status">
      <h2 id={`${id}-ok`} className={styles.sectionTitle}>
        Tu horario está apartado
      </h2>
      <p>
        Tienes <strong>8 minutos</strong> para pagar el anticipo y enviar tu número de comprobante.
        Pasado ese tiempo el horario se libera.
      </p>
      <p
        className={styles.countdown}
        aria-live="off"
        aria-label={`Tiempo restante ${formatCountdown(left)}`}
      >
        {formatCountdown(left)}
      </p>
      {summary}

      <div className={styles.qrBox}>
        <h3>Paga con QR</h3>
        {booking.paymentQrRef && isImageRef(booking.paymentQrRef) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.qrImage}
            src={booking.paymentQrRef}
            alt={`Código QR para pagar el anticipo de Bs ${formatCentsAsBs(booking.depositCents)}`}
          />
        ) : booking.paymentQrRef ? (
          <p>
            Referencia del QR de pago: <strong>{booking.paymentQrRef}</strong>
          </p>
        ) : (
          <p>
            El QR de pago aún no está disponible. Escríbenos por WhatsApp para recibir los datos de
            pago.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className={styles.proofForm}>
        {errors.length > 0 ? (
          <div className={styles.errorBox} role="alert">
            {errors.map((message) => (
              <p key={message} style={{ margin: 0 }}>
                {message}
              </p>
            ))}
          </div>
        ) : null}
        <div className={styles.fieldGroup}>
          <label htmlFor={`${id}-receipt`}>Número de comprobante</label>
          <input
            id={`${id}-receipt`}
            value={receipt}
            maxLength={30}
            autoComplete="off"
            onChange={(event) => setReceipt(event.target.value)}
          />
          <span className={styles.hint}>
            Lo encuentras en el comprobante de tu banco, después de pagar.
          </span>
        </div>
        <button type="submit" className={styles.button} disabled={sending}>
          {sending ? 'Enviando…' : 'Enviar comprobante'}
        </button>
        {errors.some((message) => /WhatsApp/.test(message)) ? (
          <WhatsappHelp phone={booking.whatsappPhone} />
        ) : null}
      </form>
    </section>
  );
}
