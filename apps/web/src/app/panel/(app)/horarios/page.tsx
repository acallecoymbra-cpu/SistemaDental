'use client';

import type { AvailabilityInterval } from '@sistema-dental/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { availabilityApi, formatServiceDate, sortIntervals } from '@/features/availability/api';
import { AvailabilityForm } from '@/features/availability/AvailabilityForm';

/**
 * Horarios de atención (T-02): crear, editar y eliminar intervalos por fecha.
 * Mismo flujo del molde: cargar lista → acción → llamar a la API → actualizar el estado
 * local con la respuesta del servidor. Eliminar pide confirmación dentro de la página
 * (no con un cuadro del navegador) para poder probarlo y para que funcione bien en celular.
 */
export default function AvailabilityPage() {
  const [items, setItems] = useState<AvailabilityInterval[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await availabilityApi.list());
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(item: AvailabilityInterval) {
    setActionError(null);
    try {
      await availabilityApi.remove(item.id);
      setItems((current) => current?.filter((i) => i.id !== item.id) ?? null);
      setConfirmingId(null);
      setNotice('Intervalo eliminado.');
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <>
      <h1>Horarios de atención</h1>
      <p className="muted">
        Define los días y horas en que atiendes. Los pacientes solo podrán reservar dentro de estos
        intervalos.
      </p>

      <section className="section card" aria-labelledby="nuevo">
        <h2 id="nuevo">Nuevo intervalo</h2>
        <AvailabilityForm
          submitLabel="Agregar"
          onSubmit={async (values) => {
            const created = await availabilityApi.create(values);
            setItems((current) => sortIntervals(current ? [...current, created] : [created]));
            setNotice('Intervalo agregado.');
          }}
        />
      </section>

      <section className="section" aria-labelledby="lista">
        <h2 id="lista">Intervalos</h2>
        {notice ? (
          <p className="alert alert-success" role="status">
            {notice}
          </p>
        ) : null}
        <ErrorAlert error={loadError ?? actionError} />
        {items === null && !loadError ? <p className="muted">Cargando…</p> : null}
        {items && items.length === 0 ? (
          <p className="muted">Aún no hay intervalos de atención.</p>
        ) : null}
        {items && items.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id}>
                    <td colSpan={4}>
                      <AvailabilityForm
                        initial={item}
                        submitLabel="Guardar cambios"
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (values) => {
                          const updated = await availabilityApi.update(item.id, values);
                          setItems((current) =>
                            sortIntervals(
                              current?.map((i) => (i.id === updated.id ? updated : i)) ?? [],
                            ),
                          );
                          setEditingId(null);
                          setNotice('Cambios guardados.');
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id}>
                    <td data-label="Fecha">{formatServiceDate(item.serviceDate)}</td>
                    <td data-label="Inicio">{item.startsLocal}</td>
                    <td data-label="Fin">{item.endsLocal}</td>
                    <td>
                      {confirmingId === item.id ? (
                        <div className="btn-row">
                          <span>¿Eliminar este intervalo?</span>
                          <button className="btn" type="button" onClick={() => void remove(item)}>
                            Sí, eliminar
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => setConfirmingId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="btn-row">
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => setEditingId(item.id)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => {
                              setNotice(null);
                              setConfirmingId(item.id);
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
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
