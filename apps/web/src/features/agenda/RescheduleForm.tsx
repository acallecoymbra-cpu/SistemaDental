'use client';

import {
  todayInClinicTimeZone,
  type AdminAppointment,
  type AvailableSlot,
} from '@sistema-dental/contracts';
import { useEffect, useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { agendaApi } from './api';

/** Elegir fecha y una franja libre para mover una consulta (T-12). */
export function RescheduleForm({
  item,
  busy,
  onSubmit,
  onClose,
}: {
  item: AdminAppointment;
  busy: boolean;
  onSubmit: (startsAt: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayInClinicTimeZone());
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    setSlots(null);
    setSelected('');
    agendaApi
      .slots(date)
      .then((res) => {
        if (active) {
          setSlots(res.slots.filter((slot) => slot.startsAt !== item.startsAt));
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err);
      });
    return () => {
      active = false;
    };
  }, [date, item.startsAt]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) onSubmit(selected);
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={`fecha-nueva-${item.id}`}>Nueva fecha</label>
        <input
          id={`fecha-nueva-${item.id}`}
          type="date"
          value={date}
          min={todayInClinicTimeZone()}
          onChange={(event) => event.target.value && setDate(event.target.value)}
        />
      </div>
      <ErrorAlert error={error} />
      <div className="field">
        <span id={`franjas-${item.id}`}>Horarios libres</span>
        {slots === null && !error ? <p className="muted">Cargando horarios…</p> : null}
        {slots?.length === 0 ? <p className="muted">No hay horarios libres ese día.</p> : null}
        <div role="radiogroup" aria-labelledby={`franjas-${item.id}`} className="btn-row">
          {slots?.map((slot) => (
            <button
              key={slot.startsAt}
              type="button"
              role="radio"
              aria-checked={selected === slot.startsAt}
              className={selected === slot.startsAt ? 'btn' : 'btn btn-secondary'}
              onClick={() => setSelected(slot.startsAt)}
            >
              {slot.startsLocal}
            </button>
          ))}
        </div>
      </div>
      <div className="btn-row">
        <button className="btn" type="submit" disabled={!selected || busy}>
          {busy ? 'Reprogramando…' : 'Confirmar nuevo horario'}
        </button>
        <button className="btn btn-secondary" type="button" onClick={onClose}>
          Volver
        </button>
      </div>
    </form>
  );
}
