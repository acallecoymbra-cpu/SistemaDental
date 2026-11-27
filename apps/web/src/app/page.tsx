import {
  formatCentsAsBs,
  type PublicClinicInfo,
  type PublicTreatment,
} from '@sistema-dental/contracts';
import Link from 'next/link';
import { fetchPublic } from '@/lib/api-server';
import { whatsappLink } from '@/features/portal/whatsapp';
import { ChatWidget } from '@/features/chat/ChatWidget';
import { buildChatContext } from '@/features/chat/context';
import { PortalHeader } from '@/features/portal/PortalHeader';
import styles from './portal.module.css';

// Se arma en cada visita, no durante el build: en el build la API no está corriendo.
export const dynamic = 'force-dynamic';

/**
 * Portal público (componente de servidor, T-04): inicio, tratamientos activos y botón de
 * WhatsApp. Pide los datos a la API en el servidor y entrega HTML listo. No hay selección de
 * profesional. Si la API no responde, la página igual se muestra con un aviso.
 */
export default async function HomePage() {
  const [treatments, clinic] = await Promise.all([
    fetchPublic<PublicTreatment[]>('/treatments'),
    fetchPublic<PublicClinicInfo>('/clinic'),
  ]);
  const whatsapp = whatsappLink(clinic?.whatsappPhone);

  return (
    <div className={styles.root}>
      <PortalHeader whatsapp={whatsapp} />

      <main>
        <section id="inicio" className={`${styles.wrap} ${styles.hero}`} aria-labelledby="titulo">
          <div>
            <p className={styles.eyebrow}>CONSULTORIO DENTAL</p>
            <h1 id="titulo" className={styles.heroTitle}>
              Renovando Sonrisas: tu salud dental, <em>sin complicaciones.</em>
            </h1>
            <p className={styles.heroLead}>
              Consultas de 45 minutos, con tratamientos explicados con claridad. Mira lo que
              ofrecemos y escríbenos cuando quieras.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.button} href="/reservar">
                Reservar cita
              </Link>
              <a className={styles.buttonOutline} href="#tratamientos">
                Ver tratamientos
              </a>
              {whatsapp ? (
                <a
                  className={styles.button}
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Escribir por WhatsApp
                </a>
              ) : null}
            </div>
          </div>
          {clinic ? (
            <aside className={styles.arch} aria-label="Valores de la consulta">
              <div>
                <p className={styles.archLabel}>CONSULTA</p>
                <p className={styles.archValue}>
                  Bs {formatCentsAsBs(clinic.consultationPriceCents)}
                </p>
              </div>
              <div>
                <p className={styles.archLabel}>ANTICIPO PARA RESERVAR</p>
                <p className={styles.archValue}>Bs {formatCentsAsBs(clinic.depositCents)}</p>
              </div>
              <p className={styles.archNote}>Cada consulta dura 45 minutos.</p>
            </aside>
          ) : null}
        </section>

        <section className={styles.trust} aria-label="Cómo atendemos">
          <ul className={styles.trustList}>
            <li>
              <p className={styles.trustTitle}>Horarios claros</p>
              <p className={styles.trustText}>Franjas de 45 minutos, sin esperas improvisadas.</p>
            </li>
            <li>
              <p className={styles.trustTitle}>Un solo anticipo</p>
              <p className={styles.trustText}>Se paga una vez para confirmar tu cita.</p>
            </li>
            <li>
              <p className={styles.trustTitle}>Contacto directo</p>
              <p className={styles.trustText}>Resolvemos tus dudas por WhatsApp.</p>
            </li>
          </ul>
        </section>

        <section
          id="tratamientos"
          className={`${styles.wrap} ${styles.section}`}
          aria-labelledby="trat"
        >
          <h2 id="trat" className={styles.sectionTitle}>
            Tratamientos
          </h2>
          <p className={styles.sectionLead}>Lo que realizamos en el consultorio.</p>
          {treatments === null ? (
            <p className={styles.notice} role="alert">
              No pudimos cargar los tratamientos en este momento. Intente más tarde.
            </p>
          ) : (
            <ul className={styles.treatments}>
              {treatments.map((t) => (
                <li key={t.id} className={styles.treatment}>
                  <h3>{t.name}</h3>
                  {t.description ? <p>{t.description}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="contacto" className={styles.contact} aria-labelledby="cont">
          <div className={`${styles.wrap} ${styles.section}`}>
            <h2 id="cont" className={styles.sectionTitle}>
              Contacto
            </h2>
            {whatsapp ? (
              <>
                <p className={styles.sectionLead}>
                  Escríbenos por WhatsApp para consultar horarios o resolver cualquier duda.
                </p>
                <a
                  className={styles.button}
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Escribir por WhatsApp
                </a>
              </>
            ) : (
              <p className={styles.sectionLead}>Pronto publicaremos nuestro medio de contacto.</p>
            )}
          </div>
        </section>
      </main>

      <ChatWidget context={buildChatContext(treatments, clinic, whatsapp)} />

      <footer className={`${styles.wrap} ${styles.footer}`}>
        <span>© {new Date().getFullYear()} Renovando Sonrisas</span>
        <a href="/mis-consultas">Mis consultas</a>
        <a href="/panel">Acceso del dentista</a>
      </footer>
    </div>
  );
}
