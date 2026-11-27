# Diseño: CI del paciente, nombre por partes y celular con código de país

**Fecha:** 2026-11-27 · **Estado:** PROPUESTA, pendiente de aprobación de la desarrolladora y de confirmación del propietario (cambia RF-03, RF-08, RF-22 y el detalle de ADR-003).
**Pedido por:** la desarrolladora del proyecto, en sesión de Claude Code (2026-11-27).

## 1. Intención

Hoy «Mis consultas» y el reconocimiento del paciente que vuelve a reservar exigen el **nombre completo exacto** + celular. Un paciente que reservó como «María José de la Roca Pérez» y luego escribe «Maria de la Roca» no encuentra nada. Además, los celulares no guardan su país: solo los bolivianos de 8 dígitos se reconocen, y los extranjeros quedan como dígitos sueltos.

Se quiere:

1. **Identificar con primer nombre + primer apellido + celular** (no el nombre completo).
2. **Normalizar los nombres** quitando espacios y puntos, en minúsculas: «De la Roca» se compara como `delaroca`.
3. **Celular con selector de país** (como el de la captura de referencia: bandera + país, y al lado el número), con **Bolivia (+591) preseleccionado**; el paciente escribe solo el número, sin prefijo.
4. **CI como dato del paciente.** Solo se registra y se muestra; **no** sirve para identificarse.

## 2. Objetivos, no objetivos y anti-objetivos

- **Objetivos:** encontrar al paciente aunque no escriba su nombre completo igual que al registrarse; guardar el país de cada celular; registrar el CI.
- **No objetivos:** identificarse con el CI; lista de todos los países del mundo; validar el CI contra el SEGIP; verificar la posesión del celular (sigue sin código, ADR-003).
- **Anti-objetivos (sería un fracaso aunque funcione):**
  - que la consulta pública funcione **sin celular** (expone citas a quien conozca un nombre);
  - que un paciente existente deje de encontrarse por el cambio;
  - que `+591 7…` y `7…` vuelvan a tratarse como celulares distintos.

## 3. Enfoques considerados

| Enfoque | Resumen | Por qué sí / no |
|---|---|---|
| A. `libphonenumber-js`, todos los países | Validación exacta por país | ~100 KB y una dependencia nueva; no aporta para un consultorio en Santa Cruz |
| **B. Lista corta propia, sin dependencias (ELEGIDO)** | 8 países en `contracts` | Liviano (~1–2 KB), sin dependencia; validación exacta solo para Bolivia |
| C. Selector solo visual | Se guarda como hoy | No resuelve el país de los celulares extranjeros ni los enlaces de WhatsApp |

**Elegido por la desarrolladora: B**, con Bolivia, sus vecinos, Estados Unidos y España.

## 4. Diseño

### 4.1 Países (`packages/contracts/src/phone.ts`, nuevo)

Lista fija, en este orden (Bolivia primero y preseleccionada):

| ISO | País | Código | Validación del número nacional |
|---|---|---|---|
| BO | Bolivia | 591 | exactamente 8 dígitos |
| AR | Argentina | 54 | 6–14 dígitos |
| BR | Brasil | 55 | 6–14 dígitos |
| CL | Chile | 56 | 6–14 dígitos |
| PE | Perú | 51 | 6–14 dígitos |
| PY | Paraguay | 595 | 6–14 dígitos |
| US | Estados Unidos | 1 | 6–14 dígitos |
| ES | España | 34 | 6–14 dígitos |

- La bandera se arma desde el código ISO (emoji de indicador regional); el nombre va en español en la lista.
- Funciones puras compartidas: `normalizeNationalNumber(texto)` (solo dígitos) y `validatePhone(countryCode, nationalNumber)`.
- Si el paciente pega un número con su prefijo (p. ej. `+591 70000000` o `59170000000` con Bolivia elegida), se quita el prefijo del país elegido cuando lo que queda tiene la longitud válida (mismo espíritu que el `normalizePhone` actual).

### 4.2 Nombres

- El formulario pide **Nombre(s)**, **Primer apellido** y **Segundo apellido (opcional)**.
- Se guarda el texto tal como se escribió (para mostrarlo) y **claves de comparación**:
  - normalización: sin tildes (`ñ` → `n`, como hoy), minúsculas y **solo letras `a–z`**: se quitan espacios, puntos, guiones y apóstrofos. «De la Roca» → `delaroca`; «María José» → `mariajose`.
  - `first_given_name_key`: la primera palabra de Nombre(s) normalizada (`maria`).
  - `given_names_key`: todo Nombre(s) normalizado (`mariajose`).
  - `first_surname_key`: primer apellido normalizado (`delaroca`).
- Al consultar, el «nombre» escrito por el paciente coincide si su clave es igual a `first_given_name_key` **o** a `given_names_key` (sirve «María» y «María José»).
- `full_name` **se mantiene** como nombre para mostrar, armado como `Nombre(s) Primer apellido Segundo apellido`. Así la agenda, los correos, la ficha y los enlaces de WhatsApp no cambian. `normalized_name` se mantiene para el buscador del panel.

### 4.3 CI

- Campo «CI» de texto: se guarda en mayúsculas, sin espacios ni puntos (`1234567 sc` → `1234567SC`); se aceptan dígitos, letras y guion (complemento `-1B`, pasaportes extranjeros); 4–20 caracteres.
- **Obligatorio** al registrarse un **adulto** por la web; **opcional** para menores y en el panel del dentista (fichas migradas en papel pueden no tenerlo).
- **Único** cuando existe: dos pacientes no pueden tener el mismo CI (en el panel, 409; en la web, error genérico, ver §4.5).
- Lo ve solo el dentista (ficha y listado del panel). **Nunca** en respuestas públicas ni en la auditoría.

### 4.4 Base de datos (migración nueva; no se edita `CreatePatients`)

Tabla `patient`, columnas nuevas:

| Columna | Tipo | Regla |
|---|---|---|
| `given_names` | `varchar(80)` NOT NULL | no vacío |
| `first_surname` | `varchar(60)` NOT NULL | no vacío |
| `second_surname` | `varchar(60)` NULL | |
| `first_given_name_key`, `given_names_key`, `first_surname_key` | `varchar` NOT NULL | `CHECK (~ '^[a-z]+$')` |
| `second_surname_key` | `varchar` NULL | `CHECK (~ '^[a-z]+$')`; NULL si no hay segundo apellido |
| `phone_country_code` | `varchar(4)` NOT NULL | `CHECK IN ('591','54','55','56','51','595','1','34')` |
| `guardian_phone_country_code` | `varchar(4)` NULL | igual; NOT NULL si hay `guardian_phone` |
| `ci` | `varchar(20)` NULL | `CHECK (~ '^[0-9A-Z-]{4,20}$')`; `UNIQUE ... WHERE ci IS NOT NULL` |

- `phone` y `guardian_phone` pasan a guardar **solo el número nacional** (para Bolivia, los 8 dígitos de siempre).
- Unicidad de paciente: se reemplaza `UNIQUE(normalized_name, phone)` por `UNIQUE(given_names_key, first_surname_key, coalesce(second_surname_key,''), phone_country_code, phone)` (sigue valiendo V-02: mismo celular con otro nombre = otro paciente).
- Índice para la consulta: `(first_surname_key, phone_country_code, phone)` y el equivalente sobre el apoderado.
- **Datos existentes** (solo hay bases de desarrollo/prueba; no hay producción): el nombre se separa por palabras (1.ª → Nombre(s), resto → primer apellido; si hay una sola palabra se repite como apellido) y el país se deduce: 8 dígitos → 591; si empieza con un código de la lista y lo restante es válido, se separa; si no se puede deducir, la migración **falla** con un mensaje claro en vez de inventar.
- `down()` revierte a las columnas anteriores (rearmando `phone` con el código de país para los no bolivianos). Si algún celular rearmado no cabe en la columna anterior (más de 15 dígitos), `down()` **falla** con un mensaje claro, igual que `up()`; no trunca. *(Decisión de diseño de Claude Code.)*
- `clinic_settings.whatsapp_phone`: la misma migración reescribe un valor guardado sin `+` y de 8 dígitos como `+591…`; los demás quedan igual. *(Decisión de diseño de Claude Code.)*

### 4.5 API y contratos

- `CreatePatientRequest`, `UpdatePatientRequest` y `BookingPatientRequest`: `fullName` se reemplaza por `givenNames`, `firstSurname`, `secondSurname?`; se agregan `phoneCountryCode`, `guardianPhoneCountryCode?` y `ci?`.
- `AdminPatient`: agrega esos campos; `fullName` sigue presente (solo lectura).
- `PublicLookupRequest`: `{ firstName, firstSurname, phoneCountryCode, phone }`.
- **Paciente que vuelve a reservar** («Sí, ya estoy registrado»): `BookingPatientRequest` pasa a ser una unión con `kind: 'returning' | 'new'`. `returning` envía solo primer nombre, primer apellido, país, celular y correo; `new` envía todos los datos de registro. Se busca con **la misma regla que «Mis consultas»**, incluido el celular del apoderado (así se identifican los menores, V-18). *(Decisiones de diseño de Claude Code.)*
  - 0 coincidencias → 400 genérico «No encontramos tus datos. Si es tu primera vez, elige "No"».
  - más de 1 (p. ej. padre e hijo con el mismo nombre y celular) → 409 «Hay más de un paciente con esos datos; escríbenos por WhatsApp».
- **Registro nuevo por la web que dejaría la consulta ambigua:** si ya existe un paciente que coincide con la regla de consulta (mismo primer nombre o nombres, primer apellido y celular), la web **no** crea otro: responde 409 «Ya hay un paciente con ese nombre y celular. Si eres tú, elige "Sí, ya estoy registrado"; si no, escríbenos por WhatsApp». El dentista sí puede crear ese paciente desde el panel (casos reales como padre e hijo), aceptando que esos dos compartirán la consulta. *(Decisión de diseño de Claude Code.)*
- **CI duplicado en la web:** error **genérico** (400 «No pudimos registrar tus datos. Escríbenos por WhatsApp»), sin revelar que el CI ya existe. El CI **nunca** sirve para encontrar a un paciente existente. En el panel, el dentista sí ve el 409 «Ese CI ya pertenece a otro paciente». *(Decisión de diseño de Claude Code.)*
- **Mis consultas** con varias coincidencias: devuelve las citas de todas (comparten nombre y celular; mismo criterio que hoy con el celular del apoderado). Errores genéricos y bloqueo RF-09 sin cambios.
- El **WhatsApp de la clínica** (`clinic_settings.whatsapp_phone`) usa el mismo selector en Configuración y se sigue guardando como `+<código><número>`; esto corrige el enlace roto cuando se guardaba sin prefijo. Para cargarlo en el selector se toma el código más largo de la lista que coincida con el inicio; si ninguno coincide, se muestra Bolivia con el número tal cual para que el dentista lo corrija. El enlace al paciente en la agenda usa `phone_country_code + phone`.
- Auditoría: igual que hoy, sin celular, correo ni CI.

### 4.6 Pantalla

Componente `PhoneInput` (reemplaza al no versionado actual):

```text
Código del país            Número de celular
[ 🇧🇴 Bolivia        ⌄ ]   [ +591 | 70000000      ]
```

- Un `<select>` nativo (accesible y usable en celular) y el campo de número con el prefijo visible y no editable.
- Se usa en: reserva (celular y apoderado), «Mis consultas», formulario de paciente del panel y Configuración (WhatsApp).
- Formularios de nombre en tres campos; «Mis consultas» y «ya estoy registrado» piden solo **Nombre** y **Primer apellido**.
- Responsive a 360 px: selector y número se apilan.

## 5. Restricciones

- Sin dependencias nuevas. Migración nueva con prueba; `synchronize: false`.
- Repositorio público: datos de prueba inventados; nunca el número real del consultorio en código, semillas ni pruebas.
- Cambia requisitos aprobados en el detalle (RF-03, RF-08/CU-03, RF-22, V-02): registrar en `VALIDACION-REQUISITOS.md` como **V-26 (CI)** y **V-27 (nombre por partes, consulta con primer nombre + primer apellido + celular, país del celular)**, estado PROPUESTA hasta que el propietario confirme; actualizar `DATA-MODEL.md` (`patient`) y la nota de ADR-003.

## 6. Pruebas

- **Contratos (unitarias):** normalización (`De la Roca` → `delaroca`, puntos, tildes, guiones); claves de nombre; validación de celular por país (Bolivia 8 dígitos; otros 6–14; prefijo pegado se quita); CI normalizado y patrón.
- **Integración (PostgreSQL real):** migración aplica/revierte con datos de ejemplo; alta y edición con partes de nombre, país y CI; CI duplicado → 409 en el panel y error genérico en la web; registro web ambiguo → 409; CI obligatorio para adulto en la web y opcional para menor; consulta con «María» y con «María José»; con otro país → no encuentra; paciente que vuelve: 0 / 1 / varias coincidencias; las reglas existentes de reserva, apoderado y bloqueo siguen pasando; la auditoría no contiene CI ni celular.
- **E2E (escritorio y 360 px):** reservar como nuevo con Bolivia por defecto; reservar con otro país; consultar con primer nombre + primer apellido; registrar paciente en el panel con CI.
- Se actualizan las pruebas existentes que envían `fullName`.

## 7. Queda a criterio de quien implemente

- Nombres exactos de funciones, archivos y mensajes (en español, en `contracts`).
- Orden interno de los pasos de la migración.
- Detalles visuales del selector, siempre que se vea la bandera, el país y el prefijo.
