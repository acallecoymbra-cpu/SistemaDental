'use client';

import {
  PATIENT_GIVEN_NAMES_MAX_LENGTH,
  PATIENT_SURNAME_MAX_LENGTH,
  isMinorOn,
  todayInClinicTimeZone,
  type AvailableSlot,
  type BookingPatientRequest,
  type PhoneDialCode,
  type PublicBooking,
  type PublicTreatment,
} from '@sistema-dental/contracts';
import { useId, useState, type FormEvent } from 'react';
import { PhoneInput } from '@/components/PhoneInput';
import styles from '@/app/portal.module.css';
import { ApiError } from '@/lib/api-client';
import { bookingApi } from './api';
import { PaymentStep } from './PaymentStep';

function tomorrow(): string {
  const [y, m, d] = todayInClinicTimeZone().split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

function messageOf(error: unknown): string[] {
  return error instanceof ApiError ? error.messages : ['Ocurrió un error inesperado.'];
}

/**
 * Reserva en un solo formulario: tratamiento → fecha → horario → datos. Los horarios se piden
 * a la API al elegir la fecha; la API decide si la franja sigue libre (si otra persona la
 * ganó, responde 409 y se muestra el mensaje sin perder lo escrito).
 */
export function BookingFlow({ treatments }: { treatments: PublicTreatment[] }) {
  const id = useId();
  const [treatmentId, setTreatmentId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [registered, setRegistered] = useState<'si' | 'no'>('no');
  const [birthDate, setBirthDate] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [booking, setBooking] = useState<PublicBooking | null>(null);

  const showGuardian = birthDate !== '' && isMinorOn(birthDate, todayInClinicTimeZone());

  async function loadSlots(value: string) {
    setDate(value);
    setStartsAt('');
    setSlots(null);
    setSlotsError(null);
    if (!value) {
      return;
    }
    try {
      setSlots((await bookingApi.slots(value)).slots);
    } catch (error) {
      setSlotsError(messageOf(error).join(' '));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    if (!treatmentId) {
      setErrors(['Elige un tratamiento.']);
      return;
    }
    if (!startsAt) {
      setErrors(['Elige una fecha y un horario.']);
      return;
    }
    const dial = (name: string) => text(name) as PhoneDialCode;
    const patient: BookingPatientRequest =
      registered === 'si'
        ? {
            kind: 'returning',
            firstName: text('firstName'),
            firstSurname: text('firstSurname'),
            phoneCountryCode: dial('phoneCountryCode'),
            phone: text('phone'),
            email: text('email'),
          }
        : {
            kind: 'new',
            givenNames: text('givenNames'),
            firstSurname: text('firstSurname'),
            secondSurname: text('secondSurname') || null,
            ci: text('ci') || null,
            phoneCountryCode: dial('phoneCountryCode'),
            phone: text('phone'),
            email: text('email'),
            birthDate: text('birthDate'),
            guardianPhoneCountryCode: showGuardian ? dial('guardianPhoneCountryCode') : null,
            guardianPhone: showGuardian ? text('guardianPhone') || null : null,
          };
    setSending(true);
    setErrors([]);
    try {
      const result = await bookingApi.book({ treatmentId, startsAt, patient });
      setBooking(result);
    } catch (error) {
      setErrors(messageOf(error));
      // Si la franja se ocupó, se recargan los horarios para elegir otra.
      if (error instanceof ApiError && error.status === 409 && date) {
        void loadSlots(date);
      }
    } finally {
      setSending(false);
    }
  }

  if (booking) {
    return <PaymentStep booking={booking} />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {errors.length > 0 ? (
        <div className={styles.errorBox} role="alert">
          {errors.map((message) => (
            <p key={message} style={{ margin: 0 }}>
              {message}
            </p>
          ))}
        </div>
      ) : null}

      <section className={styles.stepCard} aria-labelledby={`${id}-s1`}>
        <h2 id={`${id}-s1`}>1. Tratamiento</h2>
        <div className={styles.fieldGroup}>
          <label htmlFor={`${id}-treatment`}>Tratamiento</label>
          <select
            id={`${id}-treatment`}
            value={treatmentId}
            onChange={(event) => setTreatmentId(event.target.value)}
          >
            <option value="">Elige un tratamiento</option>
            {treatments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className={styles.stepCard} aria-labelledby={`${id}-s2`}>
        <h2 id={`${id}-s2`}>2. Fecha y horario</h2>
        <div className={styles.fieldGroup}>
          <label htmlFor={`${id}-date`}>Fecha</label>
          <input
            id={`${id}-date`}
            type="date"
            min={tomorrow()}
            value={date}
            onChange={(event) => void loadSlots(event.target.value)}
          />
          <span className={styles.hint}>
            Se atiende desde mañana, según los horarios publicados.
          </span>
        </div>
        {slotsError ? <p className={styles.errorBox}>{slotsError}</p> : null}
        {slots && slots.length === 0 ? (
          <p>No hay horarios libres ese día. Prueba con otra fecha.</p>
        ) : null}
        {slots && slots.length > 0 ? (
          <ul className={styles.slots} aria-label="Horarios libres">
            {slots.map((slot) => (
              <li key={slot.startsAt}>
                <button
                  type="button"
                  className={styles.slot}
                  aria-pressed={startsAt === slot.startsAt}
                  onClick={() => setStartsAt(slot.startsAt)}
                >
                  {slot.startsLocal}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.stepCard} aria-labelledby={`${id}-s3`}>
        <h2 id={`${id}-s3`}>3. Tus datos</h2>
        <fieldset
          className={styles.fieldGroup}
          style={{ border: 0, padding: 0, margin: '0 0 14px' }}
        >
          <legend>¿Ya te atendiste con nosotros?</legend>
          <div className={styles.radios}>
            <label>
              <input
                type="radio"
                name="registered"
                checked={registered === 'si'}
                onChange={() => setRegistered('si')}
              />
              Sí, ya estoy registrado
            </label>
            <label>
              <input
                type="radio"
                name="registered"
                checked={registered === 'no'}
                onChange={() => setRegistered('no')}
              />
              No, es mi primera vez
            </label>
          </div>
        </fieldset>
        {registered === 'si' ? (
          <div className={styles.fieldGroup}>
            <label htmlFor={`${id}-first-name`}>Nombre</label>
            <input
              id={`${id}-first-name`}
              name="firstName"
              autoComplete="given-name"
              maxLength={PATIENT_GIVEN_NAMES_MAX_LENGTH}
            />
            <span className={styles.hint}>Basta con tu primer nombre.</span>
          </div>
        ) : (
          <div className={styles.fieldGroup}>
            <label htmlFor={`${id}-given`}>Nombre(s)</label>
            <input
              id={`${id}-given`}
              name="givenNames"
              autoComplete="given-name"
              maxLength={PATIENT_GIVEN_NAMES_MAX_LENGTH}
            />
          </div>
        )}
        <div className={styles.fieldGroup}>
          <label htmlFor={`${id}-surname`}>Primer apellido</label>
          <input
            id={`${id}-surname`}
            name="firstSurname"
            autoComplete="family-name"
            maxLength={PATIENT_SURNAME_MAX_LENGTH}
          />
        </div>
        {registered === 'no' ? (
          <>
            <div className={styles.fieldGroup}>
              <label htmlFor={`${id}-surname2`}>Segundo apellido (opcional)</label>
              <input
                id={`${id}-surname2`}
                name="secondSurname"
                maxLength={PATIENT_SURNAME_MAX_LENGTH}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor={`${id}-ci`}>CI</label>
              <input id={`${id}-ci`} name="ci" maxLength={30} autoComplete="off" />
              <span className={styles.hint}>Obligatorio si eres mayor de edad.</span>
            </div>
          </>
        ) : null}
        <PhoneInput
          id={`${id}-phone`}
          name="phone"
          label="Celular"
          fieldClassName={styles.fieldGroup}
          hintClassName={styles.hint}
          hint={
            registered === 'si'
              ? 'Si la consulta es de un menor de edad, escribe el celular de su apoderado.'
              : undefined
          }
        />
        <div className={styles.fieldGroup}>
          <label htmlFor={`${id}-email`}>Correo</label>
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" />
        </div>
        {registered === 'no' ? (
          <>
            <div className={styles.fieldGroup}>
              <label htmlFor={`${id}-birth`}>Fecha de nacimiento</label>
              <input
                id={`${id}-birth`}
                name="birthDate"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
              />
            </div>
            {showGuardian ? (
              <PhoneInput
                id={`${id}-guardian`}
                name="guardianPhone"
                label="Celular del apoderado"
                countryLabel="Código del país del apoderado"
                autoComplete="off"
                fieldClassName={styles.fieldGroup}
                hintClassName={styles.hint}
                hint="Obligatorio para menores de 18 años."
              />
            ) : null}
          </>
        ) : null}
      </section>

      <button type="submit" className={styles.button} disabled={sending}>
        {sending ? 'Reservando…' : 'Reservar'}
      </button>
    </form>
  );
}
