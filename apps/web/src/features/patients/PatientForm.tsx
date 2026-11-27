'use client';

import {
  PATIENT_EMAIL_MAX_LENGTH,
  PATIENT_GIVEN_NAMES_MAX_LENGTH,
  PATIENT_SURNAME_MAX_LENGTH,
  type AdminPatient,
  type PhoneDialCode,
} from '@sistema-dental/contracts';
import { useId, useState, type FormEvent } from 'react';
import { PhoneInput } from '@/components/PhoneInput';
import { ErrorAlert } from '@/components/ErrorAlert';

export interface PatientFormValues {
  givenNames: string;
  firstSurname: string;
  secondSurname: string | null;
  ci: string | null;
  phoneCountryCode: PhoneDialCode;
  phone: string;
  email: string | null;
  birthDate: string | null;
  guardianPhoneCountryCode: PhoneDialCode | null;
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
      const guardianPhone = emptyToNull(form.get('guardianPhone'));
      await onSubmit({
        givenNames: String(form.get('givenNames') ?? '').trim(),
        firstSurname: String(form.get('firstSurname') ?? '').trim(),
        secondSurname: emptyToNull(form.get('secondSurname')),
        ci: emptyToNull(form.get('ci')),
        phoneCountryCode: String(form.get('phoneCountryCode') ?? '591') as PhoneDialCode,
        phone: String(form.get('phone') ?? '').trim(),
        email: emptyToNull(form.get('email')),
        birthDate: emptyToNull(form.get('birthDate')),
        guardianPhoneCountryCode: guardianPhone
          ? (String(form.get('guardianPhoneCountryCode') ?? '591') as PhoneDialCode)
          : null,
        guardianPhone,
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
        <label htmlFor={`${id}-given`}>Nombre(s)</label>
        <input
          id={`${id}-given`}
          name="givenNames"
          defaultValue={initial?.givenNames}
          maxLength={PATIENT_GIVEN_NAMES_MAX_LENGTH}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-surname`}>Primer apellido</label>
        <input
          id={`${id}-surname`}
          name="firstSurname"
          defaultValue={initial?.firstSurname}
          maxLength={PATIENT_SURNAME_MAX_LENGTH}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-surname2`}>Segundo apellido (opcional)</label>
        <input
          id={`${id}-surname2`}
          name="secondSurname"
          defaultValue={initial?.secondSurname ?? ''}
          maxLength={PATIENT_SURNAME_MAX_LENGTH}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-ci`}>CI (opcional)</label>
        <input id={`${id}-ci`} name="ci" defaultValue={initial?.ci ?? ''} maxLength={30} />
      </div>
      <PhoneInput
        id={`${id}-phone`}
        name="phone"
        label="Celular"
        defaultDialCode={initial?.phoneCountryCode}
        defaultNumber={initial?.phone}
        required
        fieldClassName="field"
        hintClassName="hint"
      />
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
      <PhoneInput
        id={`${id}-guardian`}
        name="guardianPhone"
        label="Celular del apoderado"
        countryLabel="Código del país del apoderado"
        autoComplete="off"
        defaultDialCode={initial?.guardianPhoneCountryCode ?? undefined}
        defaultNumber={initial?.guardianPhone ?? ''}
        fieldClassName="field"
        hintClassName="hint"
        hint="Obligatorio si el paciente es menor de 18 años."
      />
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
