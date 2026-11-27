import {
  isValidNationalNumber,
  nameKey,
  normalizeNationalNumber,
  type PhoneDialCode,
} from '@sistema-dental/contracts';

/**
 * Regla única para encontrar a un paciente sin cuenta (V-27): primer nombre (o todos los
 * nombres) + primer apellido + celular con su país. El celular puede ser el del paciente o el de
 * su apoderado (V-18). La usan «Mis consultas» y el paciente que vuelve a reservar.
 */
export interface LookupKey {
  firstNameKey: string;
  firstSurnameKey: string;
  dialCode: PhoneDialCode;
  national: string;
}

/** Devuelve null si algún dato no sirve para buscar (nombre sin letras, celular inválido). */
export function lookupKeyOf(input: {
  firstName: string;
  firstSurname: string;
  phoneCountryCode: PhoneDialCode;
  phone: string;
}): LookupKey | null {
  const firstNameKey = nameKey(input.firstName);
  const firstSurnameKey = nameKey(input.firstSurname);
  const national = normalizeNationalNumber(input.phoneCountryCode, input.phone);
  if (
    !firstNameKey ||
    !firstSurnameKey ||
    !isValidNationalNumber(input.phoneCountryCode, national)
  ) {
    return null;
  }
  return { firstNameKey, firstSurnameKey, dialCode: input.phoneCountryCode, national };
}

/** Condición SQL sobre la tabla `patient` con alias `alias`; usa 4 parámetros desde `$first`. */
export function patientLookupSql(alias: string, first: number): string {
  const [name, surname, dial, phone] = [first, first + 1, first + 2, first + 3].map((n) => `$${n}`);
  return `(${alias}.first_surname_key = ${surname}
    AND ${name} IN (${alias}.first_given_name_key, ${alias}.given_names_key)
    AND ((${alias}.phone_country_code = ${dial} AND ${alias}.phone = ${phone})
      OR (${alias}.guardian_phone_country_code = ${dial} AND ${alias}.guardian_phone = ${phone})))`;
}

/** Parámetros en el orden que espera `patientLookupSql`. */
export function lookupParams(key: LookupKey): [string, string, string, string] {
  return [key.firstNameKey, key.firstSurnameKey, key.dialCode, key.national];
}
