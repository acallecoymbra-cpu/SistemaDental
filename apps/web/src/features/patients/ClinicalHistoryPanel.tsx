'use client';

import {
  CLINICAL_ANAMNESIS_MAX_LENGTH,
  CLINICAL_DIAGNOSIS_MAX_LENGTH,
  CLINICAL_INDEX_MAX_LENGTH,
  type ClinicalContent,
  type ClinicalHistory,
  type ClinicalVersion,
} from '@sistema-dental/contracts';
import { useEffect, useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { formatShortDate, formatTime, localDate } from '@/features/agenda/dates';
import { patientsApi } from './api';

const EMPTY: ClinicalContent = {
  anamnesis: '',
  dentalIndexType: '',
  dentalIndexValue: '',
  diagnosis: '',
};

function when(iso: string): string {
  return `${formatShortDate(localDate(iso))} ${formatTime(iso)}`;
}

function toContent(version: ClinicalVersion | null): ClinicalContent {
  return version
    ? {
        anamnesis: version.anamnesis,
        dentalIndexType: version.dentalIndexType,
        dentalIndexValue: version.dentalIndexValue,
        diagnosis: version.diagnosis,
      }
    : EMPTY;
}

/** Historia clínica por versiones (T-15): editar la vigente y ver las anteriores (solo lectura). */
export function ClinicalHistoryPanel({ patientId }: { patientId: string }) {
  const [history, setHistory] = useState<ClinicalHistory | null>(null);
  const [form, setForm] = useState<ClinicalContent>(EMPTY);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<ClinicalVersion | null>(null);

  useEffect(() => {
    let active = true;
    patientsApi
      .clinicalHistory(patientId)
      .then((result) => {
        if (active) {
          setHistory(result);
          setForm(toContent(result.current));
        }
      })
      .catch((err: unknown) => active && setError(err));
    return () => {
      active = false;
    };
  }, [patientId]);

  function change(field: keyof ClinicalContent, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setNotice(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const result = await patientsApi.saveClinicalHistory(patientId, form);
      setError(null);
      if (result.saved && result.current) {
        setNotice(`Se guardó la versión ${result.current.versionNumber}.`);
        setHistory(await patientsApi.clinicalHistory(patientId));
        setForm(toContent(result.current));
      } else {
        setNotice('No hay cambios: no se creó una versión nueva.');
      }
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleView(versionNumber: number) {
    try {
      setViewing(await patientsApi.clinicalVersion(patientId, versionNumber));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }

  const older = history?.versions.slice(1) ?? [];

  return (
    <section className="section card" aria-labelledby="historia">
      <h2 id="historia">Historia clínica</h2>
      <ErrorAlert error={error} />
      {history === null && !error ? <p className="muted">Cargando…</p> : null}
      {history ? (
        <>
          <p className="muted">
            {history.current
              ? `Versión vigente: ${history.current.versionNumber} · ${when(history.current.createdAt)} · ${history.current.createdByName}`
              : 'Todavía no hay historia clínica. Al guardar se crea la versión 1.'}
          </p>
          <form className="form" onSubmit={(event) => void handleSave(event)}>
            <div className="field">
              <label htmlFor="hc-anamnesis">Anamnesis</label>
              <textarea
                id="hc-anamnesis"
                rows={5}
                maxLength={CLINICAL_ANAMNESIS_MAX_LENGTH}
                value={form.anamnesis}
                onChange={(event) => change('anamnesis', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="hc-index-type">Índice (tipo)</label>
              <input
                id="hc-index-type"
                maxLength={CLINICAL_INDEX_MAX_LENGTH}
                value={form.dentalIndexType}
                onChange={(event) => change('dentalIndexType', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="hc-index-value">Índice (valor)</label>
              <input
                id="hc-index-value"
                maxLength={CLINICAL_INDEX_MAX_LENGTH}
                value={form.dentalIndexValue}
                onChange={(event) => change('dentalIndexValue', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="hc-diagnosis">Diagnóstico</label>
              <textarea
                id="hc-diagnosis"
                rows={3}
                maxLength={CLINICAL_DIAGNOSIS_MAX_LENGTH}
                value={form.diagnosis}
                onChange={(event) => change('diagnosis', event.target.value)}
              />
            </div>
            {notice ? (
              <p className="alert alert-success" role="status">
                {notice}
              </p>
            ) : null}
            <div className="btn-row">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar historia'}
              </button>
            </div>
            <span className="muted">
              Cada cambio crea una versión nueva; las anteriores no se pueden editar.
            </span>
          </form>

          {older.length > 0 ? (
            <div>
              <h3>Versiones anteriores</h3>
              <ul>
                {older.map((version) => (
                  <li key={version.versionNumber}>
                    Versión {version.versionNumber} · {when(version.createdAt)} ·{' '}
                    {version.createdByName}{' '}
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => void handleView(version.versionNumber)}
                    >
                      Ver versión {version.versionNumber}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {viewing ? (
            <dl className="card" aria-label={`Versión ${viewing.versionNumber}`}>
              <h3>
                Versión {viewing.versionNumber} (solo lectura) · {when(viewing.createdAt)}
              </h3>
              <dt className="muted">Anamnesis</dt>
              <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{viewing.anamnesis || '—'}</dd>
              <dt className="muted">Índice</dt>
              <dd style={{ margin: 0 }}>
                {viewing.dentalIndexType || viewing.dentalIndexValue
                  ? `${viewing.dentalIndexType}: ${viewing.dentalIndexValue}`
                  : '—'}
              </dd>
              <dt className="muted">Diagnóstico</dt>
              <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{viewing.diagnosis || '—'}</dd>
              <div className="btn-row">
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setViewing(null)}
                >
                  Cerrar versión
                </button>
              </div>
            </dl>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
