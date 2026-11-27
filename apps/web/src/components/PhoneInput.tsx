'use client';

import {
  DEFAULT_PHONE_DIAL_CODE,
  PHONE_COUNTRIES,
  flagEmoji,
  type PhoneDialCode,
} from '@sistema-dental/contracts';
import { useState, type InputEvent as ReactInputEvent, type ReactNode } from 'react';
import { sanitizePhoneInput } from '@/lib/phone-input';
import styles from './PhoneInput.module.css';

interface Props {
  /** id del campo del número; el selector de país usa `${id}-country`. */
  id: string;
  /** name del número; el país se envía como `${name}CountryCode`. */
  name: string;
  /** Etiqueta del número (p. ej. «Celular»). */
  label: string;
  /** Etiqueta del selector de país. */
  countryLabel?: string;
  defaultDialCode?: PhoneDialCode;
  defaultNumber?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: ReactNode;
  /** Clase de cada campo (la del portal o la del panel), para heredar sus estilos. */
  fieldClassName?: string;
  hintClassName?: string;
}

/**
 * Celular con código de país (V-27): a la izquierda el país (Bolivia por defecto), a la derecha
 * el número sin prefijo, con el prefijo a la vista. El campo del número no deja escribir ni
 * pegar letras; la API vuelve a validar y normaliza.
 */
export function PhoneInput({
  id,
  name,
  label,
  countryLabel = 'Código del país',
  defaultDialCode = DEFAULT_PHONE_DIAL_CODE,
  defaultNumber,
  required,
  autoComplete = 'tel-national',
  hint,
  fieldClassName,
  hintClassName,
}: Props) {
  const [dialCode, setDialCode] = useState<PhoneDialCode>(defaultDialCode);

  function handleInput(event: ReactInputEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const clean = sanitizePhoneInput(input.value);
    if (clean !== input.value) {
      input.value = clean;
    }
  }

  return (
    <div className={styles.row}>
      <div className={fieldClassName}>
        <label htmlFor={`${id}-country`}>{countryLabel}</label>
        <select
          id={`${id}-country`}
          name={`${name}CountryCode`}
          value={dialCode}
          onChange={(event) => setDialCode(event.target.value as PhoneDialCode)}
        >
          {PHONE_COUNTRIES.map((country) => (
            <option key={country.dialCode} value={country.dialCode}>
              {`${flagEmoji(country.iso)} ${country.name}`}
            </option>
          ))}
        </select>
      </div>
      <div className={fieldClassName}>
        <label htmlFor={id}>{label}</label>
        <div className={styles.numberRow}>
          <span className={styles.prefix}>{`+${dialCode}`}</span>
          <input
            id={id}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete={autoComplete}
            maxLength={20}
            defaultValue={defaultNumber}
            required={required}
            onInput={handleInput}
          />
        </div>
        {hint ? <span className={hintClassName}>{hint}</span> : null}
      </div>
    </div>
  );
}
