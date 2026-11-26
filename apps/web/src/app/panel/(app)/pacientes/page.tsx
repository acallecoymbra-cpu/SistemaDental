'use client';

import type { AdminPatient } from '@sistema-dental/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { formatBirthDate, patientsApi } from '@/features/patients/api';
import { PatientForm } from '@/features/patients/PatientForm';

/**
 * Pacientes (T-05): buscar por nombre o celular, crear y editar.
 * Los avisos (celular compartido) se muestran, pero no impiden guardar.
 */
export default function PatientsPage() {
  const [items, setItems] = useState<AdminPatient[] | null>(null);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(async (q: string) => {
    try {
      setItems(await patientsApi.search(q));
      setSearched(q);
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    }
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setWarnings([]);
    void load(query.trim());
  }

  function showResult(message: string, resultWarnings: string[]) {
    setNotice(message);
    setWarnings(resultWarnings);
  }

  return (
    <>
      <h1>Pacientes</h1>
      <p className="muted">
        Busca por nombre o celular. Los menores se identifican con el celular de su apoderado.
      </p>

      <section className="section card" aria-labelledby="nuevo">
        <h2 id="nuevo">Nuevo paciente</h2>
        <PatientForm
          submitLabel="Agregar"
          onSubmit={async (values) => {
            const { patient, warnings: w } = await patientsApi.create(values);
            showResult(`«${patient.fullName}» agregado.`, w);
            await load(searched);
          }}
        />
      </section>

      <section className="section" aria-labelledby="lista">
        <h2 id="lista">Lista</h2>
        <form className="form" onSubmit={handleSearch} role="search">
          <div className="field">
            <label htmlFor="busqueda">Buscar por nombre o celular</label>
            <input
              id="busqueda"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={120}
            />
          </div>
          <div className="btn-row">
            <button className="btn" type="submit">
              Buscar
            </button>
          </div>
        </form>
        {notice ? (
          <p className="alert alert-success" role="status">
            {notice}
          </p>
        ) : null}
        {warnings.map((w) => (
          <p key={w} className="alert alert-error" role="status">
            {w}
          </p>
        ))}
        <ErrorAlert error={loadError} />
        {items === null && !loadError ? <p className="muted">Cargando…</p> : null}
        {items && items.length === 0 ? (
          <p className="muted">
            {searched ? 'No se encontraron pacientes con ese dato.' : 'Aún no hay pacientes.'}
          </p>
        ) : null}
        {items && items.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Celular</th>
                <th>Nacimiento</th>
                <th>Apoderado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) =>
                editingId === p.id ? (
                  <tr key={p.id}>
                    <td colSpan={5}>
                      <PatientForm
                        initial={p}
                        submitLabel="Guardar cambios"
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (values) => {
                          const { warnings: w } = await patientsApi.update(p.id, values);
                          setEditingId(null);
                          showResult('Cambios guardados.', w);
                          await load(searched);
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td data-label="Nombre">
                      {p.fullName}{' '}
                      {p.isMinor ? <span className="badge badge-off">Menor</span> : null}
                    </td>
                    <td data-label="Celular">{p.phone}</td>
                    <td data-label="Nacimiento">{formatBirthDate(p.birthDate)}</td>
                    <td data-label="Apoderado">{p.guardianPhone ?? '—'}</td>
                    <td>
                      <div className="btn-row">
                        <Link className="btn btn-secondary" href={`/panel/pacientes/${p.id}`}>
                          Ver ficha
                        </Link>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => setEditingId(p.id)}
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        ) : null}
      </section>
    </>
  );
}
