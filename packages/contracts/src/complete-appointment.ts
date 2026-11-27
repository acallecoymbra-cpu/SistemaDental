/** Cerrar consulta (RF-20, T-17): diagnóstico y costo obligatorios; después queda de solo lectura. */

export const COMPLETE_DIAGNOSIS_MAX_LENGTH = 2000;
/** Tope razonable del costo (Bs 9.999.999,99), en centavos. */
export const COMPLETE_COST_MAX_CENTS = 999_999_999;

export interface CompleteAppointmentRequest {
  diagnosis: string;
  /** Costo de la consulta en centavos de Bs (0 o más). */
  costCents: number;
}
