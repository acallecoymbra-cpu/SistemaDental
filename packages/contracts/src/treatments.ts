/** Catálogo de tratamientos (RF-01, RF-15, B-05: módulo molde). */

export const TREATMENT_NAME_MAX_LENGTH = 80;
export const TREATMENT_DESCRIPTION_MAX_LENGTH = 500;

/** Lo que ve el paciente en el portal: solo tratamientos activos y datos mínimos. */
export interface PublicTreatment {
  id: string;
  name: string;
  description: string | null;
}

/** Lo que ve el dentista en el panel. */
export interface AdminTreatment extends PublicTreatment {
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTreatmentRequest {
  name: string;
  description?: string | null;
}

/** Todos los campos son opcionales: solo se cambia lo que se envía. */
export interface UpdateTreatmentRequest {
  name?: string;
  description?: string | null;
  active?: boolean;
}
