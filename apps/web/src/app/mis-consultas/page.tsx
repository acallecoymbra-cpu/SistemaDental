import type { PublicClinicInfo } from '@sistema-dental/contracts';
import { LookupFlow } from '@/features/lookup/LookupFlow';
import { PortalHeader } from '@/features/portal/PortalHeader';
import { whatsappLink } from '@/features/portal/whatsapp';
import { fetchPublic } from '@/lib/api-server';
import styles from '../portal.module.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Mis consultas · Renovando Sonrisas' };

/** Mis consultas (T-09): el paciente ve sus consultas con su nombre y su celular. */
export default async function MyAppointmentsPage() {
  const clinic = await fetchPublic<PublicClinicInfo>('/clinic');
  const whatsapp = whatsappLink(clinic?.whatsappPhone);

  return (
    <div className={styles.root}>
      <PortalHeader whatsapp={whatsapp} />
      <main className={`${styles.wrap} ${styles.bookWrap}`}>
        <h1 className={styles.sectionTitle}>Mis consultas</h1>
        <p className={styles.sectionLead}>
          Escribe tu nombre y tu celular para ver el estado de tus consultas.
        </p>
        <LookupFlow whatsapp={whatsapp} />
      </main>
    </div>
  );
}
