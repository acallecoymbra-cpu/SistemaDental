'use client';

import {
  TREATMENT_DESCRIPTION_MAX_LENGTH,
  TREATMENT_NAME_MAX_LENGTH,
  type AdminTreatment,
} from '@sistema-dental/contracts';
import { useId, useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';

export interface TreatmentFormValues {
  name: string;
  description: string | null;
}

interface Props {
  /** Si viene, el formulario edita ese tratamiento; si no, crea uno nuevo. */
  initial?: AdminTreatment;
  submitLabel: string;
  onSubmit: (values: TreatmentFormValues) => Promise<void>;
  onCancel?: () => void;
}

/**
 * Formulario reutilizable para crear y editar. Patrón del molde:
 * - límites tomados de `contracts` (los mismos que valida la API);
 * - el botón se desactiva mientras se envía;
 * - los errores de la API se muestran con <ErrorAlert>, sin perder lo escrito.
 */
export function TreatmentForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const id = useId();
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const description = String(form.get('description') ?? '').trim();
    setSending(true);
    setError(null);
    try {
      await onSubmit({
        name: String(form.get('name') ?? '').trim(),
        description: description.length > 0 ? description : null,
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
        <label htmlFor={`${id}-name`}>Nombre</label>
        <input
          id={`${id}-name`}
          name="name"
          defaultValue={initial?.name}
          maxLength={TREATMENT_NAME_MAX_LENGTH}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-description`}>Descripción (opcional)</label>
        <textarea
          id={`${id}-description`}
          name="description"
          rows={2}
          defaultValue={initial?.description ?? ''}
          maxLength={TREATMENT_DESCRIPTION_MAX_LENGTH}
        />
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
