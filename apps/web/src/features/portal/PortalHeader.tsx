import Link from 'next/link';
import styles from '@/app/portal.module.css';

/** Símbolo propio de la marca: un arco con una sonrisa. */
function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="12" fill="#123d3a" />
      <path
        d="M10 22c2.5 6 17.5 6 20 0"
        fill="none"
        stroke="#cfe6dd"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M12 16a8 8 0 0 1 16 0"
        fill="none"
        stroke="#f6f3ec"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Cabecera del portal público (inicio y reserva). `whatsapp` es el enlace ya armado, o null. */
export function PortalHeader({ whatsapp }: { whatsapp: string | null }) {
  return (
    <header className={styles.header}>
      <div className={`${styles.wrap} ${styles.headerInner}`}>
        <Link href="/" className={styles.brand} aria-label="Renovando Sonrisas, inicio">
          <Mark />
          <span>
            <span className={styles.brandName}>Renovando Sonrisas</span>
            <span className={styles.brandTag}>CONSULTORIO DENTAL</span>
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Secciones del portal">
          <Link href="/#tratamientos">Tratamientos</Link>
          <Link href="/mis-consultas">Mis consultas</Link>
          <Link href="/#contacto">Contacto</Link>
        </nav>
        <Link className={styles.button} href="/reservar">
          Reservar cita
        </Link>
        {whatsapp ? (
          <a
            className={`${styles.buttonOutline} ${styles.hideOnMobile}`}
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        ) : null}
      </div>
    </header>
  );
}
