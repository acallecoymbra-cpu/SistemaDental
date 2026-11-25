'use client';

import type { AdminTreatment } from '@sistema-dental/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { treatmentsApi } from '@/features/treatments/api';
import { TreatmentForm } from '@/features/treatments/TreatmentForm';

/**
 * Pantalla molde (B-05): listar, crear, editar y activar/desactivar.
 * Flujo de datos: cargar lista → acción del usuario → llamar a la API →
 * reemplazar el elemento en el estado local con la respuesta del servidor.
 */
export default function TreatmentsPage() {
  const [items, setItems] = useState<AdminTreatment[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await treatmentsApi.list());
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function replace(updated: AdminTreatment) {
    setItems((current) => current?.map((t) => (t.id === updated.id ? updated : t)) ?? null);
  }

  async function toggleActive(t: AdminTreatment) {
    setActionError(null);
    try {
      replace(await treatmentsApi.update(t.id, { active: !t.active }));
      setNotice(`«${t.name}» ${t.active ? 'desactivado' : 'activado'}.`);
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <>
      <h1>Tratamientos</h1>
      <p className="muted">
        Los tratamientos activos se muestran en el portal. Desactivar no borra el historial.
      </p>

      <section className="section card" aria-labelledby="nuevo">
        <h2 id="nuevo">Nuevo tratamiento</h2>
        <TreatmentForm
          submitLabel="Agregar"
          onSubmit={async (values) => {
            const created = await treatmentsApi.create(values);
            setItems((current) => (current ? [created, ...current] : [created]));
            setNotice(`«${created.name}» agregado.`);
          }}
        />
      </section>

      <section className="section" aria-labelledby="lista">
        <h2 id="lista">Catálogo</h2>
        {notice ? (
          <p className="alert alert-success" role="status">
            {notice}
          </p>
        ) : null}
        <ErrorAlert error={loadError ?? actionError} />
        {items === null && !loadError ? <p className="muted">Cargando…</p> : null}
        {items && items.length === 0 ? <p className="muted">Aún no hay tratamientos.</p> : null}
        {items && items.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) =>
                editingId === t.id ? (
                  <tr key={t.id}>
                    <td colSpan={4}>
                      <TreatmentForm
                        initial={t}
                        submitLabel="Guardar cambios"
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (values) => {
                          replace(await treatmentsApi.update(t.id, values));
                          setEditingId(null);
                          setNotice('Cambios guardados.');
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td data-label="Nombre">{t.name}</td>
                    <td data-label="Descripción">{t.description ?? '—'}</td>
                    <td data-label="Estado">
                      <span className={t.active ? 'badge' : 'badge badge-off'}>
                        {t.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => setEditingId(t.id)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => void toggleActive(t)}
                        >
                          {t.active ? 'Desactivar' : 'Activar'}
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
