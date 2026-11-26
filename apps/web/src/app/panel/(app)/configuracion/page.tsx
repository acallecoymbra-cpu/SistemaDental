'use client';

import type { ClinicSettings } from '@sistema-dental/contracts';
import { useEffect, useState } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { clinicApi } from '@/features/clinic/api';
import { ClinicSettingsForm } from '@/features/clinic/ClinicSettingsForm';

/** Configuración de la clínica (T-01): precio, anticipo único, QR y WhatsApp. */
export default function ClinicSettingsPage() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    clinicApi.get().then(setSettings, setLoadError);
  }, []);

  return (
    <>
      <h1>Configuración</h1>
      <p className="muted">
        Precio de la consulta, anticipo, QR de pago y WhatsApp. El saldo se paga en el consultorio.
      </p>
      <section className="section card" aria-labelledby="datos">
        <h2 id="datos">Datos de la clínica</h2>
        {notice ? (
          <p className="alert alert-success" role="status">
            {notice}
          </p>
        ) : null}
        <ErrorAlert error={loadError} />
        {settings === null && !loadError ? <p className="muted">Cargando…</p> : null}
        {settings ? (
          <ClinicSettingsForm
            key={settings.updatedAt}
            initial={settings}
            onSubmit={async (values) => {
              setSettings(await clinicApi.update(values));
              setNotice('Configuración guardada.');
            }}
          />
        ) : null}
      </section>
    </>
  );
}
