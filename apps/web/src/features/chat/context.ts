import {
  formatCentsAsBs,
  type PublicClinicInfo,
  type PublicTreatment,
} from '@sistema-dental/contracts';
import type { ChatContext } from './rules';

/** Arma el contexto del chat con lo que ya cargó la página (sin pedir nada más a la API). */
export function buildChatContext(
  treatments: PublicTreatment[] | null,
  clinic: PublicClinicInfo | null,
  whatsappUrl: string | null,
): ChatContext {
  return {
    treatments: treatments ?? [],
    priceText: clinic ? formatCentsAsBs(clinic.consultationPriceCents) : null,
    depositText: clinic ? formatCentsAsBs(clinic.depositCents) : null,
    whatsappUrl,
  };
}
