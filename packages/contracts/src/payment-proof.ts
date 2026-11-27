/** Comprobante de pago del anticipo (RF-06, T-07). */

/** Número de comprobante: letras, números y guiones (4 a 30 caracteres). */
export const RECEIPT_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,30}$/;

/** Número de comprobante tal como se guarda y se compara: sin espacios y en mayúsculas. */
export function normalizeReceiptNumber(value: string): string {
  return value.trim().toUpperCase();
}

export interface SubmitPaymentProofRequest {
  receiptNumber: string;
}

/** Respuesta al enviar el comprobante: la cita sigue «por pagar» hasta que la doctora confirme. */
export interface PaymentProofReceived {
  appointmentId: string;
  submittedAt: string;
}
