/** Historia clínica por versiones (RF-24, T-15). Solo el dentista. */

export const CLINICAL_ANAMNESIS_MAX_LENGTH = 5000;
export const CLINICAL_DIAGNOSIS_MAX_LENGTH = 2000;
export const CLINICAL_INDEX_MAX_LENGTH = 40;

/** Contenido clínico de una versión. Texto vacío = sin dato. */
export interface ClinicalContent {
  anamnesis: string;
  /** Tipo de índice (p. ej. el que use la doctora). Va junto con su valor. */
  dentalIndexType: string;
  dentalIndexValue: string;
  diagnosis: string;
}

export type SaveClinicalVersionRequest = ClinicalContent;

export interface ClinicalVersionSummary {
  versionNumber: number;
  createdAt: string;
  createdByName: string;
}

export interface ClinicalVersion extends ClinicalVersionSummary, ClinicalContent {
  id: string;
}

export interface ClinicalHistory {
  /** La versión vigente (la más reciente), o `null` si todavía no hay historia. */
  current: ClinicalVersion | null;
  /** De la más reciente a la más antigua, sin contenido. */
  versions: ClinicalVersionSummary[];
}

export interface SaveClinicalVersionResponse {
  /** `false` si no había cambios (o todo estaba vacío): no se creó versión. */
  saved: boolean;
  current: ClinicalVersion | null;
}

/** Quita espacios sobrantes y normaliza saltos de línea, para comparar y guardar igual. */
export function normalizeClinicalContent(content: ClinicalContent): ClinicalContent {
  const clean = (value: string) => value.replace(/\r\n?/g, '\n').trim();
  return {
    anamnesis: clean(content.anamnesis),
    dentalIndexType: clean(content.dentalIndexType),
    dentalIndexValue: clean(content.dentalIndexValue),
    diagnosis: clean(content.diagnosis),
  };
}

export function isClinicalContentEmpty(content: ClinicalContent): boolean {
  return Object.values(content).every((value) => value === '');
}

export function sameClinicalContent(a: ClinicalContent, b: ClinicalContent): boolean {
  const x = normalizeClinicalContent(a);
  const y = normalizeClinicalContent(b);
  return (
    x.anamnesis === y.anamnesis &&
    x.dentalIndexType === y.dentalIndexType &&
    x.dentalIndexValue === y.dentalIndexValue &&
    x.diagnosis === y.diagnosis
  );
}
