/** Configuración única de la clínica (RF-07, RF-15, T-01). */

import type { CURRENCY } from './money';

/** Largo máximo de la referencia al QR (enlace o nombre del archivo; la imagen no va en Git). */
export const PAYMENT_QR_REF_MAX_LENGTH = 500;

/** Celular de WhatsApp: solo dígitos, con `+` opcional al inicio (7 a 15 dígitos). */
export const WHATSAPP_PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

/** Lo que ve el dentista en el panel. */
export interface ClinicSettings {
  /** Precio de la consulta, en centavos de Bs (30 Bs = 3000). */
  consultationPriceCents: number;
  /** Anticipo único para todas las consultas, en centavos de Bs (entre 1000 y 2000). */
  depositCents: number;
  currency: typeof CURRENCY;
  /** Referencia al QR vigente de pago. */
  paymentQrRef: string | null;
  /** Número de WhatsApp del consultorio. */
  whatsappPhone: string | null;
  updatedAt: string;
}

/** Datos mínimos que ve cualquier visitante del portal. El QR NO está aquí. */
export interface PublicClinicInfo {
  consultationPriceCents: number;
  depositCents: number;
  whatsappPhone: string | null;
}

/** Todos los campos son opcionales: solo se cambia lo que se envía. */
export interface UpdateClinicSettingsRequest {
  consultationPriceCents?: number;
  depositCents?: number;
  paymentQrRef?: string | null;
  whatsappPhone?: string | null;
}
