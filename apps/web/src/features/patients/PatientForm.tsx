'use client';

import {
  PATIENT_EMAIL_MAX_LENGTH,
  PATIENT_NAME_MAX_LENGTH,
  type AdminPatient,
} from '@sistema-dental/contracts';
import { useId, useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';

export interface PatientFormValues {
  fullName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  guardianPhone: string | null;
}

interface Props {
  /** Si viene, el formulario edita ese paciente; si no, crea uno nuevo. */
  initial?: AdminPatient;
  submitLabel: string;
  onSubmit: (values: PatientFormValues) => Promise<void>;
  onCancel?: () => void;
}

const emptyToNull = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
};

/**
 * Formulario para crear y editar pacientes. Los errores de la API (celular inválido,
 * menor sin apoderado, duplicado…) se muestran sin perder lo escrito.
 */
export function PatientForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
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
        fullName: String(form.get('fullName') ?? '').trim(),
        phone: String(form.get('phone') ?? '').trim(),
        email: emptyToNull(form.get('email')),
        birthDate: emptyToNull(form.get('birthDate')),
        guardianPhone: emptyToNull(form.get('guardianPhone')),
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
        <label htmlFor={`${id}-name`}>Nombre completo</label>
        <input
          id={`${id}-name`}
          name="fullName"
          defaultValue={initial?.fullName}
          maxLength={PATIENT_NAME_MAX_LENGTH}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-phone`}>Celular</label>
        <input
          id={`${id}-phone`}
          name="phone"
          inputMode="tel"
          defaultValue={initial?.phone}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-email`}>Correo (opcional)</label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          defaultValue={initial?.email ?? ''}
          maxLength={PATIENT_EMAIL_MAX_LENGTH}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-birth`}>Fecha de nacimiento (opcional)</label>
        <input
          id={`${id}-birth`}
          name="birthDate"
          type="date"
          defaultValue={initial?.birthDate ?? ''}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-guardian`}>Celular del apoderado</label>
        <input
          id={`${id}-guardian`}
          name="guardianPhone"
          inputMode="tel"
          defaultValue={initial?.guardianPhone ?? ''}
        />
        <span className="hint">Obligatorio si el paciente es menor de 18 años.</span>
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
