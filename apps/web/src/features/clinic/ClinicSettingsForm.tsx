'use client';

import {
  DEPOSIT_MAX_CENTS,
  DEPOSIT_MIN_CENTS,
  PAYMENT_QR_REF_MAX_LENGTH,
  formatCentsAsBs,
  parseBsToCents,
  type ClinicSettings,
  type UpdateClinicSettingsRequest,
} from '@sistema-dental/contracts';
import { useId, useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ApiError } from '@/lib/api-client';

interface Props {
  initial: ClinicSettings;
  onSubmit: (values: UpdateClinicSettingsRequest) => Promise<void>;
}

/**
 * Formulario de configuración. Los importes se escriben en Bs (`15` o `15,50`) y se
 * envían en centavos enteros. La pantalla solo ayuda: la API valida siempre el rango.
 */
export function ClinicSettingsForm({ initial, onSubmit }: Props) {
  const id = useId();
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = parseBsToCents(String(form.get('price') ?? ''));
    const deposit = parseBsToCents(String(form.get('deposit') ?? ''));
    if (price === null || deposit === null) {
      setError(new ApiError(400, ['Escribe los importes en bolivianos, por ejemplo 15 o 15,50.']));
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSubmit({
        consultationPriceCents: price,
        depositCents: deposit,
        paymentQrRef: String(form.get('qr') ?? ''),
        whatsappPhone: String(form.get('whatsapp') ?? ''),
      });
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
        <label htmlFor={`${id}-price`}>Precio de la consulta (Bs)</label>
        <input
          id={`${id}-price`}
          name="price"
          inputMode="decimal"
          defaultValue={formatCentsAsBs(initial.consultationPriceCents)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-deposit`}>Anticipo (Bs)</label>
        <input
          id={`${id}-deposit`}
          name="deposit"
          inputMode="decimal"
          defaultValue={formatCentsAsBs(initial.depositCents)}
          required
        />
        <span className="hint">
          Es el mismo para todas las consultas: entre {formatCentsAsBs(DEPOSIT_MIN_CENTS)} y{' '}
          {formatCentsAsBs(DEPOSIT_MAX_CENTS)} Bs. No se devuelve.
        </span>
      </div>
      <div className="field">
        <label htmlFor={`${id}-qr`}>Referencia del QR de pago</label>
        <input
          id={`${id}-qr`}
          name="qr"
          defaultValue={initial.paymentQrRef ?? ''}
          maxLength={PAYMENT_QR_REF_MAX_LENGTH}
        />
        <span className="hint">
          Enlace o nombre del archivo del QR vigente. La imagen no se guarda en el sistema.
        </span>
      </div>
      <div className="field">
        <label htmlFor={`${id}-whatsapp`}>WhatsApp del consultorio</label>
        <input
          id={`${id}-whatsapp`}
          name="whatsapp"
          inputMode="tel"
          defaultValue={initial.whatsappPhone ?? ''}
        />
        <span className="hint">Solo dígitos, con el código de país. Ejemplo: 59170000000.</span>
      </div>
      <div className="btn-row">
        <button className="btn" type="submit" disabled={sending}>
          {sending ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </form>
  );
}
