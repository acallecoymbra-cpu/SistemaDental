'use client';

import type { AvailabilityInterval } from '@sistema-dental/contracts';
import { AVAILABILITY_MIN_MINUTES } from '@sistema-dental/contracts';
import { useId, useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';

export interface AvailabilityFormValues {
  serviceDate: string;
  startsLocal: string;
  endsLocal: string;
}

interface Props {
  /** Si viene, el formulario edita ese intervalo; si no, crea uno nuevo. */
  initial?: AvailabilityInterval;
  submitLabel: string;
  onSubmit: (values: AvailabilityFormValues) => Promise<void>;
  onCancel?: () => void;
}

/**
 * Formulario para crear y editar un intervalo de atención. Mismo patrón del molde:
 * el botón se desactiva mientras se envía y los errores de la API (superposición,
 * duración mínima…) se muestran con <ErrorAlert> sin perder lo escrito.
 */
export function AvailabilityForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const id = useId();
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSending(true);
    setError(null);
    try {
      await onSubmit({
        serviceDate: String(form.get('serviceDate') ?? ''),
        startsLocal: String(form.get('startsLocal') ?? ''),
        endsLocal: String(form.get('endsLocal') ?? ''),
      });
      if (!initial) {
        formElement.reset();
      }
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <ErrorAlert error={error} />
      <div className="field">
        <label htmlFor={`${id}-date`}>Fecha</label>
        <input
          id={`${id}-date`}
          name="serviceDate"
          type="date"
          defaultValue={initial?.serviceDate}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-start`}>Hora de inicio</label>
        <input
          id={`${id}-start`}
          name="startsLocal"
          type="time"
          defaultValue={initial?.startsLocal}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-end`}>Hora de fin</label>
        <input
          id={`${id}-end`}
          name="endsLocal"
          type="time"
          defaultValue={initial?.endsLocal}
          required
        />
        <span className="hint">
          Cada intervalo debe durar al menos {AVAILABILITY_MIN_MINUTES} minutos. Horas de La Paz.
        </span>
      </div>
      <div className="btn-row">
        <button className="btn" type="submit" disabled={sending}>
          {sending ? 'Guardando…' : submitLabel}
        </button>
        {onCancel ? (
          <button className="btn btn-secondary" type="button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
