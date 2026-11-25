import type { PublicTreatment } from '@sistema-dental/contracts';
import Link from 'next/link';
import { fetchPublic } from '@/lib/api-server';

// Se arma en cada visita, no durante el build:
// en el build la API no está corriendo.
export const dynamic = 'force-dynamic';

/**
 * Portal público (componente de servidor): pide los tratamientos activos a la API
 * en el servidor y entrega HTML listo. El diseño completo del portal es T-04.
 */
export default async function HomePage() {
  const treatments = await fetchPublic<PublicTreatment[]>('/treatments');

  return (
    <>
      <header className="hero">
        <div className="container">
          <h1>Renovando Sonrisas</h1>
          <p>Consultorio dental</p>
        </div>
      </header>
      <main className="container section" style={{ paddingTop: 24 }}>
        <h2>Tratamientos</h2>
        {treatments === null ? (
          <p className="alert alert-error">
            No pudimos cargar los tratamientos en este momento. Intente más tarde.
          </p>
        ) : (
          <ul className="card-grid">
            {treatments.map((t) => (
              <li key={t.id} className="card">
                <h3>{t.name}</h3>
                {t.description ? <p className="muted">{t.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link href="/panel">Acceso del dentista</Link>
        </p>
      </main>
    </>
  );
}
