import type { PublicClinicInfo, PublicTreatment } from '@sistema-dental/contracts';
import { BookingFlow } from '@/features/booking/BookingFlow';
import { ChatWidget } from '@/features/chat/ChatWidget';
import { buildChatContext } from '@/features/chat/context';
import { PortalHeader } from '@/features/portal/PortalHeader';
import { whatsappLink } from '@/features/portal/whatsapp';
import { fetchPublic } from '@/lib/api-server';
import styles from '../portal.module.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Reservar cita · Renovando Sonrisas' };

/** Reserva pública (T-06): el paciente elige tratamiento, fecha, horario y completa sus datos. */
export default async function BookPage() {
  const [treatments, clinic] = await Promise.all([
    fetchPublic<PublicTreatment[]>('/treatments'),
    fetchPublic<PublicClinicInfo>('/clinic'),
  ]);
  const whatsapp = whatsappLink(clinic?.whatsappPhone);

  return (
    <div className={styles.root}>
      <PortalHeader whatsapp={whatsapp} />
      <main className={`${styles.wrap} ${styles.bookWrap}`}>
        <h1 className={styles.sectionTitle}>Reservar cita</h1>
        <p className={styles.sectionLead}>
          Elige tratamiento, fecha y horario. Cada consulta dura 45 minutos y tu horario queda
          apartado 8 minutos mientras completas el pago del anticipo.
        </p>
        {treatments === null ? (
          <p className={styles.notice} role="alert">
            No pudimos cargar los tratamientos en este momento. Intente más tarde.
          </p>
        ) : (
          <BookingFlow treatments={treatments} />
        )}
      </main>
      <ChatWidget context={buildChatContext(treatments, clinic, whatsapp)} />
    </div>
  );
}
