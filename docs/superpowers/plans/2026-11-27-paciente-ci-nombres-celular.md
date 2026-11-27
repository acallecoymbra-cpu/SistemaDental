# CI del paciente, nombre por partes y celular con país — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El paciente se registra con nombre por partes, CI y celular con selector de país (Bolivia por defecto); «Mis consultas» y el paciente que vuelve a reservar se identifican con primer nombre + primer apellido + celular.

**Architecture:** Funciones puras y tipos en `packages/contracts` (países, claves de nombre, CI); una migración nueva agrega columnas y migra los datos; la API de pacientes, reserva y consulta usa una sola regla de búsqueda (`patient-lookup.ts`); la web usa un `PhoneInput` con `<select>` de país.

**Tech Stack:** pnpm/Turborepo, NestJS 11 + TypeORM 0.3 (PostgreSQL 17), Next.js 15 / React 19, Vitest (contracts), Jest + supertest (API), `node:test` (web), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-11-27-paciente-ci-nombres-celular-design.md`

## Global Constraints

- Node 24 (`nvm use 24`); pnpm vía `corepack pnpm` si no está en el `PATH`.
- Sin dependencias nuevas. `synchronize: false`; migración nueva, nunca editar `CreatePatients`.
- Países, en este orden: BO 591, AR 54, BR 55, CL 56, PE 51, PY 595, US 1, ES 34. Bolivia preseleccionada.
- Número nacional: Bolivia exactamente 8 dígitos; el resto 6–14 dígitos.
- Clave de nombre: sin tildes (`ñ`→`n`), minúsculas, solo `a–z` («De la Roca» → `delaroca`).
- CI: mayúsculas, sin espacios ni puntos, patrón `^[0-9A-Z-]{4,20}$`, único si existe; obligatorio solo para adulto registrándose por la web.
- La consulta pública **siempre** exige celular. CI nunca en respuestas públicas ni en auditoría.
- Textos de pantalla y mensajes de error en español. Datos de prueba inventados (repositorio público); nunca el número real del consultorio.
- **Sin STAGE / COMMIT / PUSH**: AGENTS.md exige autorización separada. Cada tarea termina con validaciones, no con commit.

## Review Focus

1. Paciente que pega el número con prefijo (`+591 7000-0000`) o con espacios y guiones: debe guardarse igual que `70000000` → test en Task 1 (`normalizeNationalNumber`) y Task 6 (E2E pegar).
2. Nombre con tildes, mayúsculas o espacios distintos al consultar («MARIA  de La roca»): debe encontrarse → test en Task 4.
3. Menor que vuelve a reservar con el celular del apoderado: debe reconocerse → test en Task 4.
4. Datos de desarrollo existentes con una sola palabra en el nombre o celular extranjero: la migración no debe perderlos ni inventar → test en Task 2.
5. Paciente creado en el panel sin CI y luego editado: no debe exigir CI ni romper la unicidad → test en Task 3.

---

### Task 0: Línea base

- [ ] **Step 1:** `nvm use 24 && corepack pnpm install --frozen-lockfile && pnpm db:up`
- [ ] **Step 2:** Correr `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`. Anotar resultados exactos (cantidades y fallos) para comparar al final. Si algo falla **antes** de tocar nada, anotarlo como preexistente y avisar; no corregirlo dentro de este plan.

### Task 1: Contratos (países, nombres, CI, tipos)

**Files:**
- Create: `packages/contracts/src/phone.ts`, `packages/contracts/src/phone.test.ts`
- Modify: `packages/contracts/src/patients.ts`, `packages/contracts/src/patients.test.ts`, `packages/contracts/src/booking.ts`, `packages/contracts/src/public-lookup.ts`, `packages/contracts/src/admin-appointments.ts`, `packages/contracts/src/clinic-settings.ts`, `packages/contracts/src/index.ts`

**Interfaces — Produces:**
- `phone.ts`:
  - `type PhoneDialCode = '591' | '54' | '55' | '56' | '51' | '595' | '1' | '34'`
  - `interface PhoneCountry { iso: string; name: string; dialCode: PhoneDialCode }`; `PHONE_COUNTRIES: readonly PhoneCountry[]` (orden de Global Constraints, nombres en español: Bolivia, Argentina, Brasil, Chile, Perú, Paraguay, Estados Unidos, España)
  - `DEFAULT_PHONE_DIAL_CODE: PhoneDialCode = '591'`
  - `isPhoneDialCode(value: unknown): value is PhoneDialCode`
  - `flagEmoji(iso: string): string` (indicadores regionales)
  - `normalizeNationalNumber(dialCode: PhoneDialCode, raw: string): string` — solo dígitos; si empiezan con `dialCode` y el resto es válido, se quita el prefijo
  - `isValidNationalNumber(dialCode: PhoneDialCode, digits: string): boolean`
  - `toE164(dialCode: PhoneDialCode, national: string): string` → `+59170000000`
  - `parseE164(value: string): { dialCode: PhoneDialCode; national: string }` — código más largo de la lista que coincida; si ninguno, `{ dialCode: '591', national: <dígitos> }`
  - `WHATSAPP_PHONE_PATTERN` pasa a `/^\+[0-9]{7,17}$/` (se mueve o se reexporta desde `clinic-settings.ts`)
- `patients.ts`:
  - `PATIENT_GIVEN_NAMES_MAX_LENGTH = 80`, `PATIENT_SURNAME_MAX_LENGTH = 60`, `CI_PATTERN = /^[0-9A-Z-]{4,20}$/`
  - `nameKey(text: string): string`; `firstWordKey(givenNames: string): string`
  - `buildFullName(givenNames: string, firstSurname: string, secondSurname: string | null): string` (partes con `trim`, unidas por un espacio)
  - `normalizeCi(raw: string): string`
  - `AdminPatient` agrega `givenNames`, `firstSurname`, `secondSurname: string | null`, `ci: string | null`, `phoneCountryCode: PhoneDialCode`, `guardianPhoneCountryCode: PhoneDialCode | null`; `fullName` se mantiene
  - `CreatePatientRequest`: `givenNames`, `firstSurname`, `secondSurname?`, `ci?`, `phoneCountryCode`, `phone`, `email?`, `birthDate?`, `guardianPhoneCountryCode?`, `guardianPhone?` (sin `fullName`); `UpdatePatientRequest`: los mismos, todos opcionales
  - `normalizePhone` y `normalizePatientName` se mantienen (buscador del panel)
- `booking.ts`: `BookingPatientRequest = ReturningBookingPatient | NewBookingPatient` con `kind: 'returning'` → `{ firstName, firstSurname, phoneCountryCode, phone, email }` y `kind: 'new'` → `{ givenNames, firstSurname, secondSurname?, ci?, phoneCountryCode, phone, email, birthDate, guardianPhoneCountryCode?, guardianPhone? }`
- `public-lookup.ts`: `PublicLookupRequest = { firstName; firstSurname; phoneCountryCode: PhoneDialCode; phone }`
- `admin-appointments.ts`: el paciente de la cita agrega `phoneCountryCode` y `guardianPhoneCountryCode`

- [ ] **Step 1: Tests que fallan** en `phone.test.ts` y `patients.test.ts`:
  - `PHONE_COUNTRIES.map(c => c.dialCode)` = `['591','54','55','56','51','595','1','34']`; `flagEmoji('BO')` = `'🇧🇴'`
  - `normalizeNationalNumber('591', '+591 7000-0000')` = `'70000000'`; `('591', '7000 0000')` = `'70000000'`; `('54', '+54 9 11 2345 6789')` = `'91123456789'`
  - `isValidNationalNumber('591','70000000')` true; `('591','7000000')` false; `('591','700000000')` false; `('54','12345')` false; `('54','123456')` true; `('34','123456789012345')` false
  - `parseE164('+59170001234')` = `{ dialCode:'591', national:'70001234' }`; `parseE164('+595981000000').dialCode` = `'595'`; `parseE164('+99912345678').dialCode` = `'591'`
  - `nameKey('De la Roca')` = `'delaroca'`; `nameKey('Muñoz-Pérez')` = `'munozperez'`; `nameKey("D'Angelo Jr.")` = `'dangelojr'`; `firstWordKey('  María José ')` = `'maria'`
  - `buildFullName('María José','de la Roca',null)` = `'María José de la Roca'`
  - `normalizeCi('1234567 sc')` = `'1234567SC'`; `normalizeCi('1.234.567-1b')` = `'1234567-1B'`; `CI_PATTERN.test('123')` false
- [ ] **Step 2:** `corepack pnpm --filter @sistema-dental/contracts test` → FAIL (funciones no existen)
- [ ] **Step 3:** Implementar las interfaces de arriba.
- [ ] **Step 4:** `corepack pnpm --filter @sistema-dental/contracts test` → PASS; `corepack pnpm --filter @sistema-dental/contracts build` → OK. (`typecheck` de api/web fallará hasta Tasks 3–6: es esperado.)

### Task 2: Migración, entidad y ayudante de pruebas

**Files:**
- Create: `apps/api/src/database/migrations/1765200000000-PatientNamePartsCiPhoneCountry.ts`, `apps/api/test/integration/patient-migration.int-spec.ts`, `apps/api/test/integration/patient-fixtures.ts`
- Modify: `apps/api/src/patients/patient.entity.ts`; los `INSERT INTO patient` crudos de `complete-appointment`, `cancel-appointment`, `clinical-history`, `appointments-slots`, `public-lookup`, `reschedule-no-show`, `patients`, `agenda`, `confirm-payment` (`*.int-spec.ts`)

**Interfaces — Produces:**
- Columnas (spec §4.4): `given_names`, `first_surname`, `second_surname`, `first_given_name_key`, `given_names_key`, `first_surname_key`, `second_surname_key`, `phone_country_code`, `guardian_phone_country_code`, `ci`; `CHECK` de claves `^[a-z]+$`, de códigos de país (lista), de CI y `CHECK ((guardian_phone IS NULL) = (guardian_phone_country_code IS NULL))`.
- Restricciones con nombre (los servicios las distinguen): `patient_identity_uq` = `UNIQUE (given_names_key, first_surname_key, coalesce(second_surname_key,''), phone_country_code, phone)` (índice único de expresión); `patient_ci_uq` = único parcial `WHERE ci IS NOT NULL`. Se elimina `patient_name_phone_uq`.
- Índices: `(first_surname_key, phone_country_code, phone)` y `(first_surname_key, guardian_phone_country_code, guardian_phone)`.
- Entidad `Patient` con las propiedades camelCase correspondientes.
- `patient-fixtures.ts`: `insertPatient(ds: DataSource | EntityManager, p: { givenNames: string; firstSurname: string; secondSurname?: string; phone: string; phoneCountryCode?: PhoneDialCode; email?: string; birthDate?: string; isMinor?: boolean; guardianPhone?: string; ci?: string; origin?: 'web' | 'dentist' }): Promise<string>` (devuelve el id; calcula claves y `full_name` con las funciones de contracts).

- [ ] **Step 1: Test que falla** `patient-migration.int-spec.ts`: base reiniciada, migrar hasta `CreateClinicalHistory1765100000000`, insertar con el esquema viejo: `('Ana', '70000001')`, `('Juan Pérez de la Roca', '5491123456789')`, `('Luis Gómez', '70000002', guardian '71000000', is_minor)`; WhatsApp `'79000000'` sin `+`. Correr la migración nueva y comprobar:
  - Ana → `given_names='Ana'`, `first_surname='Ana'`, país `591`, phone `70000001`
  - Juan → `given_names='Juan'`, `first_surname='Pérez de la Roca'`, `first_surname_key='perezdelaroca'`, país `54`, phone `91123456789`
  - Luis → apoderado país `591`
  - `clinic_settings.whatsapp_phone` = `'+59179000000'`
  - Con un celular viejo `'1234567'` (no deducible) la migración lanza error con mensaje que contiene `no se pudo deducir el país`
  - `undoLastMigration` deja `phone='5491123456789'` para Juan y `patient_name_phone_uq` de vuelta
  - con un paciente `595` + 14 dígitos (17 en total), `undoLastMigration` lanza error con mensaje que contiene `no cabe`
- [ ] **Step 2:** `corepack pnpm --filter @sistema-dental/api build && corepack pnpm --filter @sistema-dental/api test:integration -- patient-migration` → FAIL
- [ ] **Step 3:** Escribir la migración. Las funciones de normalización van **copiadas dentro del archivo** (la migración no importa `contracts`, para no cambiar si el código cambia). Datos: lectura fila por fila y `UPDATE` parametrizado; códigos probados de más largo a más corto (`595, 591, 54, 55, 56, 51, 34, 1`).
- [ ] **Step 4:** Actualizar la entidad, crear `insertPatient` y reemplazar cada `INSERT INTO patient` crudo de las pruebas por `insertPatient`.
- [ ] **Step 5:** `test:integration -- patient-migration migrations` → PASS

### Task 3: API de pacientes del panel

**Files:**
- Modify: `apps/api/src/patients/patient.dto.ts`, `apps/api/src/patients/patients.service.ts`, `apps/api/src/patients/patient-record.service.ts` (si arma `AdminPatient`), `apps/api/src/patients/MODULE.md`
- Create: `apps/api/src/patients/patient-lookup.ts`
- Test: `apps/api/test/integration/patients.int-spec.ts`

**Interfaces:**
- Consumes: Task 1 (contracts), Task 2 (entidad, nombres de restricciones)
- Produces (`patient-lookup.ts`):
  - `interface LookupKey { firstNameKey: string; firstSurnameKey: string; dialCode: PhoneDialCode; national: string }`
  - `lookupKeyOf(input: { firstName: string; firstSurname: string; phoneCountryCode: PhoneDialCode; phone: string }): LookupKey | null` (null si el celular no es válido o alguna clave queda vacía)
  - `patientLookupSql(alias: string, firstParam: number): string` — condición SQL con parámetros `$firstParam..$firstParam+3` en el orden de `lookupParams`
  - `lookupParams(key: LookupKey): [string, string, string, string]`
  - Regla: `alias.first_surname_key = $b AND $a IN (alias.first_given_name_key, alias.given_names_key) AND ((alias.phone_country_code = $c AND alias.phone = $d) OR (alias.guardian_phone_country_code = $c AND alias.guardian_phone = $d))`
- `applyRules(patient)` calcula `fullName`, `normalizedName`, claves, normaliza celulares con su país y CI; valida con mensajes: `El celular no es válido para el país elegido.`, `El celular del apoderado no es válido para el país elegido.`, `El CI solo admite números, letras y guion (4 a 20).`
- Errores de unicidad: `patient_ci_uq` → 409 `Ese CI ya pertenece a otro paciente.`; `patient_identity_uq` → 409 `Ya existe un paciente con ese nombre y celular.` (texto actual)
- `search(q)` también encuentra por CI exacto normalizado.

- [ ] **Step 1: Tests que fallan** (adaptar los existentes al nuevo cuerpo y agregar):
  - crear con `{ givenNames:'María José', firstSurname:'de la Roca', phoneCountryCode:'591', phone:'7000-0001', ci:'1234567 sc' }` → 201, `fullName='María José de la Roca'`, `phone='70000001'`, `ci='1234567SC'`
  - crear sin CI → 201; editar ese paciente sin enviar CI → 200 (Review Focus 5)
  - CI repetido en otro paciente → 409 con el texto de arriba
  - Bolivia con 7 dígitos → 400; Argentina con 10 dígitos → 201 con `phoneCountryCode='54'`
  - menor sin apoderado → 400 (regla existente)
  - `GET /admin/patients?q=1234567SC` lo encuentra
  - la fila de auditoría de creación y edición no contiene `ci` ni `phone`
- [ ] **Step 2:** `test:integration -- patients` → FAIL
- [ ] **Step 3:** Implementar DTOs (`@IsIn` de códigos de país, longitudes de contracts), `applyRules`, `toAdminPatient`, mapeo de errores por nombre de restricción, `patient-lookup.ts`.
- [ ] **Step 4:** `test:integration -- patients patient-record` → PASS

### Task 4: Reserva y «Mis consultas»

**Files:**
- Modify: `apps/api/src/appointments/booking.dto.ts`, `apps/api/src/appointments/appointments.service.ts`, `apps/api/src/patients/patients.service.ts` (`findOrCreateForBooking`), `apps/api/src/appointments/public-lookup.service.ts`, `apps/api/src/appointments/agenda.service.ts` (devolver códigos de país), `apps/api/src/appointments/MODULE.md`
- Test: `apps/api/test/integration/booking.int-spec.ts`, `public-lookup.int-spec.ts`, `payment-proof.int-spec.ts`, `agenda.int-spec.ts`

**Interfaces:**
- Consumes: `lookupKeyOf`, `patientLookupSql`, `lookupParams` (Task 3)
- `BookingPatientDto`: `kind` con `@IsIn(['returning','new'])`; campos de cada variante con `@ValidateIf(o => o.kind === ...)`.
- `findOrCreateForBooking(manager, input: BookingPatientRequest): Promise<Patient>`:
  - `returning`: busca con la regla (con `FOR UPDATE`); 0 → 400 `No encontramos tus datos. Si es tu primera vez, elige "No, es mi primera vez".`; >1 → 409 `Hay más de un paciente con esos datos. Escríbenos por WhatsApp.`; 1 → si no tenía correo, se guarda el enviado.
  - `new`: exige `birthDate` (texto actual) y, si es adulto, `ci` (`Para registrarte necesitamos tu CI.`); si alguna variante de su nombre (`firstWordKey`, `nameKey(givenNames)`) coincide con un paciente existente por la regla → 409 `Ya hay un paciente con ese nombre y celular. Si eres tú, elige "Sí, ya estoy registrado"; si no, escríbenos por WhatsApp.`; violación de `patient_ci_uq` → 400 `No pudimos registrar tus datos. Escríbenos por WhatsApp.`
- `PublicLookupService.lookup(input: PublicLookupRequest, ctx)`: `lookupKeyOf` null → cuenta como intento fallido con el mismo mensaje genérico; si no, `WHERE` con `patientLookupSql('p', 1)`. Bloqueo y mensajes sin cambios.

- [ ] **Step 1: Tests que fallan:**
  - reserva `new` adulto sin CI → 400 con el texto de arriba; menor sin CI y con apoderado → 201
  - reserva `new` con un CI ya usado → 400 genérico (sin la palabra «CI»)
  - reserva `new` de alguien que ya existe → 409 «Ya hay un paciente…»
  - reserva `returning` con `firstName:'maria'`, `firstSurname:'DE LA ROCA'`, mismo celular → 201 y el mismo `patient_id` (Review Focus 2)
  - reserva `returning` de un menor con el celular del apoderado → 201 (Review Focus 3)
  - `returning` sin coincidencias → 400; con dos coincidencias (dos pacientes creados en el panel con nombres `Juan` y `Juan Carlos`, mismo apellido y celular, consulta con `Juan`) → 409
  - «Mis consultas» con `María` y con `María José` → 200 con sus citas; con otro país (`54`) y el mismo número → 404 genérico; 5 fallos → bloqueo (prueba existente adaptada)
  - las pruebas existentes de límite de 3 pendientes, franja ocupada y comprobante siguen pasando con el cuerpo nuevo
- [ ] **Step 2:** `test:integration -- booking public-lookup payment-proof agenda` → FAIL
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `corepack pnpm --filter @sistema-dental/api test:integration` (suite completa) → PASS; `corepack pnpm --filter @sistema-dental/api typecheck` → OK

### Task 5: WhatsApp de la clínica y enlaces

**Files:**
- Modify: `apps/api/src/clinic/clinic-settings.dto.ts`, `apps/web/src/features/agenda/dates.ts`, `apps/web/src/app/panel/(app)/agenda/page.tsx`
- Test: `apps/api/test/integration/clinic.int-spec.ts`, prueba web existente de `dates` si la hay (si no, `apps/web/test/whatsapp-links.test.mjs`)

**Interfaces:**
- Consumes: `WHATSAPP_PHONE_PATTERN`, `parseE164`, `isValidNationalNumber`, `toE164` (Task 1)
- `UpdateClinicSettingsDto.whatsappPhone`: debe cumplir el patrón **y** `isValidNationalNumber(parseE164(v))`; mensaje `El WhatsApp no es válido para el país elegido.`
- `patientWhatsappLink(patient: { phone; phoneCountryCode; guardianPhone; guardianPhoneCountryCode }, message): string | null` → `https://wa.me/<código><número>`

- [ ] **Step 1: Tests que fallan:** guardar `'+59179000000'` → 200; `'79000000'` → 400; `'+5917900000'` (7 dígitos) → 400; `patientWhatsappLink` de un paciente `54`/`91123456789` → `https://wa.me/5491123456789…`; de un menor usa el del apoderado.
- [ ] **Step 2:** correr → FAIL. **Step 3:** implementar. **Step 4:** `test:integration -- clinic` y `corepack pnpm --filter @sistema-dental/web test` → PASS

### Task 6: Pantallas

**Files:**
- Modify: `apps/web/src/components/PhoneInput.tsx`, `apps/web/src/lib/phone-input.ts`, `apps/web/test/phone-input.test.mjs`, `apps/web/src/features/booking/BookingFlow.tsx`, `apps/web/src/features/lookup/LookupFlow.tsx`, `apps/web/src/features/patients/PatientForm.tsx`, `apps/web/src/features/clinic/ClinicSettingsForm.tsx`, `apps/web/src/app/panel/(app)/pacientes/page.tsx` y `pacientes/[id]/page.tsx` (mostrar CI), estilos en `apps/web/src/app/portal.module.css` / `globals.css` si hace falta
- Test: `apps/web/e2e/phone-input.e2e.ts`, `booking.e2e.ts`, `lookup.e2e.ts`, `patients.e2e.ts`, `clinic-settings.e2e.ts`, y los E2E que crean pacientes por la API (`agenda`, `cancel-appointment`, `confirm-payment`, `reschedule`, `patient-record`, `payment`)

**Interfaces:**
- `PhoneInput(props: { id: string; name: string; label: string; defaultDialCode?: PhoneDialCode; defaultNumber?: string; required?: boolean; hint?: ReactNode; autoComplete?: string })`: renderiza la etiqueta «Código del país» + `<select name={`${name}CountryCode`}>` (bandera + país, valor = código) y la etiqueta `label` + prefijo visible `+<código>` (no editable) + `<input type="tel" name={name}>` con el filtro de caracteres actual. A 360 px se apilan.
- Formularios: «Nombre(s)», «Primer apellido», «Segundo apellido (opcional)», «CI»; reserva `returning` y «Mis consultas» piden «Nombre» y «Primer apellido». La reserva envía `kind`. CI con la ayuda «Obligatorio si eres mayor de edad».
- Configuración: el WhatsApp se carga con `parseE164` y se envía con `toE164`; vacío → `null`.

- [ ] **Step 1: E2E que fallan:**
  - `/reservar`: «Código del país» muestra Bolivia por defecto y el prefijo `+591`; elegir Argentina cambia a `+54`; reservar como nuevo con CI → pantalla de pago
  - pegar `+591 7000-0003` en el número con Bolivia y reservar como nuevo; luego reservar como «Sí, ya estoy registrado» con `70000003` → reconoce al mismo paciente (Review Focus 1)
  - `/mis-consultas` con «Nombre» + «Primer apellido» + celular → lista
  - panel: crear paciente con CI y verlo en la ficha
  - Configuración: guardar WhatsApp con Bolivia y ver en el portal `wa.me/591…`
  - todo a 360 px sin scroll horizontal (proyecto móvil existente)
- [ ] **Step 2:** `corepack pnpm build && corepack pnpm test:e2e` → FAIL
- [ ] **Step 3:** Implementar componentes y formularios; actualizar los E2E que crean pacientes por API al cuerpo nuevo.
- [ ] **Step 4:** `corepack pnpm --filter @sistema-dental/web test`, `corepack pnpm build`, `corepack pnpm test:e2e` → PASS

### Task 7: Documentación y validación final

**Files:**
- Modify: `docs/VALIDACION-REQUISITOS.md` (filas **V-26** CI y **V-27** nombre por partes / consulta / país, estado PROPUESTA, procedencia: desarrolladora en sesión de Claude Code 2026-11-27, pendiente del propietario), `docs/DATA-MODEL.md` (tabla `patient`), `docs/ai/DECISIONS.md` (nota bajo ADR-003: la identificación sigue siendo nombre + celular, ahora primer nombre + primer apellido + país + número; PROPUESTA), `docs/ai/STATUS.md`, `docs/ai/HANDOFF.md`

- [ ] **Step 1:** Escribir los cambios de documentación.
- [ ] **Step 2:** Correr todo: `corepack pnpm exec prettier --check .`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`. Comparar con la línea base de Task 0.
- [ ] **Step 3:** Aplicar la migración a la base de desarrollo (`pnpm db:migrate`) y probar a mano en http://localhost:3000/reservar.
- [ ] **Step 4:** Registrar en STATUS/HANDOFF los resultados reales (PASS/FAIL/NOT EXECUTED) y pedir autorizaciones STAGE / COMMIT / PUSH por separado.
