# Odontograma (T-16): qué es y cómo se construye

**Estado:** PROPUESTA para revisión. La tarea sigue **bloqueada** hasta que la doctora confirme el catálogo de estados (V-25, ver §9).
**Para quién:** quien implemente T-16 (`docs/PLAN-IMPLEMENTACION.md`, TASK-504) y quien lo revise.
**Depende de:** T-15 (historia clínica por versiones, ya hecha). **Fuentes:** `docs/DATA-MODEL.md` (`tooth_state`), `docs/VALIDACION-REQUISITOS.md` (V-10, V-19, V-25) y la hoja «Historia Clínica Odontológica» del consultorio (Art Dent).

> **Privacidad:** la foto de la hoja del consultorio contiene datos de una paciente. **No se sube al repositorio** (es público). Solo se versiona la lista de códigos que aparece en la sección 3.

---

## 1. Qué es el odontograma

Es el esquema de la dentadura de un paciente: para cada pieza dental se anota **en qué estado está** (sana, con caries, obturada, ausente, etc.). En el consultorio hoy se hace en papel, con dos partes:

1. **Cuadrículas dibujadas**: una por cuadrante, con 8 dientes cada una. Cada diente es un cuadrado dividido en 5 zonas (un centro y cuatro triángulos).
2. **Lista de piezas con una raya** al lado de cada una, donde se escribe **una letra** del índice diagnóstico (A, B, C… Z4).

En el sistema, el odontograma **forma parte de la versión clínica**: cada vez que se guarda un cambio en la historia clínica (T-15) se crea una versión nueva, y esa versión guarda también el estado de cada pieza. Las versiones anteriores no se editan.

## 2. Notación FDI (qué número tiene cada pieza)

El consultorio usa la notación **FDI** (ya aprobada, V-19): dos dígitos, `cuadrante` + `posición`.

| Cuadrante | Dentición permanente | Dentición temporal (de leche) |
|---|---|---|
| 1 (superior derecho) | 11 a 18 | 51 a 55 |
| 2 (superior izquierdo) | 21 a 28 | 61 a 65 |
| 3 (inferior izquierdo) | 31 a 38 | 71 a 75 |
| 4 (inferior derecho) | 41 a 48 | 81 a 85 |

- Posición 1 es el incisivo central y va aumentando hacia el fondo de la boca (8 = tercer molar).
- Total de códigos válidos: **32 permanentes + 20 temporales = 52**.
- La hoja agrupa en la misma línea la pieza permanente y su equivalente temporal en las posiciones 1 a 5: `11-51`, `12-52`, `13-53`, `14-54`, `15-55` (y lo mismo en los otros tres cuadrantes). Las posiciones 6, 7 y 8 solo existen como permanentes (`16`, `17`, `18`).
- En la ficha de tratamientos del consultorio se escribe con coma (`1,6`). El sistema guarda siempre el código sin separador (`16`).

## 3. Índice diagnóstico: los estados de pieza

Es la leyenda de la hoja del consultorio. **31 códigos**, transcritos de la foto:

| Código | Significado | Código | Significado |
|---|---|---|---|
| A | Carie de esmalte | N | Resto radicular |
| B | Carie de dentina | Ñ | Deshiscencia |
| C | Exposición pulpar | O | Fenestración |
| D | Herida pulpar | P | Pericoronaritis |
| E | Carie rampante | Q | Bolsa periodontal |
| F | Pulpitis reversible | R | Enfermedad periodontal |
| G | Pulpitis irreversible | S | Alveolitis húmeda |
| H | Absceso dentoalveolar agudo | T | Alveolitis seca |
| I | Necrosis | U | Pigmentación |
| J | Gangrena | V | Fractura |
| K | «Pulpo Pulpar» (**por confirmar**, ver §9) | W | Supernumerario |
| L | Diente retenido | X | Sano |
| M | Resto coronal | Y | Ausente |
| Z | Obturado | Z1 | Provisorio |
| Z2 | C/TX conducto (con tratamiento de conducto) | Z3 | Prótesis fija |
| Z4 | Prótesis removible | | |

Reglas para esta lista:

- **No inventar ni completar códigos.** Si la doctora corrige un nombre o agrega un estado, se cambia el catálogo (no el código fuente).
- El catálogo es **datos, no código**: vive en una tabla y se administra por migración o semilla, para poder ajustarlo sin tocar la lógica.

## 4. Qué debe cumplir T-16 (criterios del plan)

- Solo se aceptan **piezas FDI válidas**, incluida la dentición temporal.
- Solo se aceptan **estados del catálogo aprobado**.
- El odontograma **se guarda con la versión clínica** de T-15: una versión nueva por cada cambio, sin tocar las anteriores.
- Guardar sin cambios no crea versión (esto ahora incluye el odontograma al comparar).
- Solo el dentista lo lee y escribe; cada lectura queda auditada **sin copiar el contenido clínico**.

## 5. Diseño de datos propuesto

> Supone **un código por pieza completa**, que es lo que sugiere la lista de la hoja. Si la doctora responde que se anota **por superficie**, hay que cambiar este diseño **antes** de crear la migración (`DATA-MODEL.md`, tabla `tooth_state`).

**Catálogo de estados** (nueva tabla, con la semilla de la sección 3):

| Columna | Tipo | Notas |
|---|---|---|
| `code` | `varchar(4)` PK | `A`…`Z`, `Ñ`, `Z1`…`Z4` |
| `name` | `varchar(80)` NOT NULL | Texto que se muestra |
| `sort_order` | `int` NOT NULL | Orden de la leyenda |
| `active` | `boolean` DEFAULT true | Desactivar en vez de borrar |

**Estado por pieza de una versión** (`tooth_state`, de `DATA-MODEL.md`):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `clinical_version_id` | `uuid` FK `clinical_version` NOT NULL | |
| `tooth_code` | `varchar(2)` NOT NULL | `CHECK` con las 52 piezas FDI válidas |
| `state_code` | `varchar(4)` FK catálogo NOT NULL | |
| | | `UNIQUE (clinical_version_id, tooth_code)` |

- **Inmutable**: igual que `clinical_version`, un disparador rechaza `UPDATE` y `DELETE` (error 23514).
- **Una pieza sin fila = sin dato.** No equivale a «Sano» (`X`): significa que no se registró nada.
- Una versión puede tener de 0 a 52 filas.

## 6. API propuesta

Se amplía lo que ya existe en `admin/patients/:id/clinical-history`; no hay rutas nuevas.

- **Contrato** (`packages/contracts/src/clinical-history.ts`):
  - `ClinicalContent` gana `teeth: { toothCode: string; stateCode: string }[]`.
  - `ClinicalVersion` devuelve el mismo `teeth`.
  - Constantes compartidas: lista de las 52 piezas FDI y catálogo de estados.
- **Guardar (`PUT`)**: en la misma transacción que crea la versión n+1, inserta sus filas de `tooth_state`.
- **Comparar «sin cambios»**: el contenido normalizado ahora incluye `teeth` **ordenado por código**, para que el orden en que llegan no cuente como cambio.
- **Validaciones (400, mensajes en español)**: pieza que no es FDI válida; estado que no está en el catálogo activo; pieza repetida en la misma petición.
- **Lectura**: `GET` de la versión vigente y `GET .../versions/:n` incluyen `teeth`. La auditoría de lectura y de creación sigue **sin copiar el contenido** (solo quién, paciente y número de versión).

## 7. Pantalla propuesta

Dentro del panel «Historia clínica» de la ficha del paciente (`ClinicalHistoryPanel`):

- **Mapa de piezas** en cuatro bloques como en la hoja: arriba, cuadrantes 1 y 2 (de 18 a 11 y de 21 a 28); abajo, cuadrantes 4 y 3 (de 48 a 41 y de 31 a 38). Entre las filas de permanentes, las filas de temporales.
- Cada pieza es un botón con su número FDI y la letra de su estado. Al elegirla, se abre la lista de estados del catálogo.
- **Leyenda** visible con los 31 códigos.
- **Versiones anteriores** se ven en solo lectura, con el mapa tal como estaba.
- **Responsive a 360 px**: los cuadrantes se apilan; sin scroll horizontal de la página.
- Accesibilidad: cada pieza con nombre accesible (por ejemplo, «Pieza 16, Obturado»), uso con teclado.

## 8. Pruebas mínimas

**Integración (PostgreSQL real)**
- Guardar con piezas y estados válidos crea la versión y devuelve `teeth`.
- Pieza fuera de FDI, estado inexistente o desactivado, y pieza repetida: 400.
- Mismo odontograma en otro orden: no crea versión. Cambiar un solo estado: crea versión n+1 y la anterior queda intacta.
- `tooth_state` no admite `UPDATE` ni `DELETE` (23514).
- Dos guardados simultáneos con distinto odontograma se numeran sin repetir.
- La auditoría no contiene códigos ni estados.
- Sin sesión: 401.

**Unitarias (contratos)**
- Las 52 piezas válidas y que `19`, `29`, `56`, `00` no lo son.
- Normalización y orden del contenido con `teeth`.

**E2E (escritorio y 360 px)**
- Marcar tres piezas, guardar, recargar y ver los estados.
- Cambiar una pieza crea la versión 2; la versión 1 se ve sin el cambio.
- Guardar sin cambios muestra «No hay cambios».

## 9. Preguntas abiertas para la doctora

Hasta que respondan, no se debe construir T-16 ni consolidar el catálogo como contrato.

1. **¿Un código por pieza o por superficie?** Es la más importante: cambia la tabla `tooth_state`. Las cuadrículas dibujadas tienen 5 zonas por diente, pero la lista de la hoja pide una sola letra por pieza.
2. **Código K:** la foto dice «Pulpo Pulpar». ¿Es «Pólipo pulpar»?
3. **¿Una pieza puede tener más de un código** (por ejemplo, obturada y con caries en otra zona)? Si sí, la restricción única cambia a `(versión, pieza, estado)`.
4. **Z1 a Z4:** ¿son subtipos de «Obturado» (Z) o códigos independientes?
5. **Dentición mixta:** ¿se pueden registrar a la vez la pieza temporal y la permanente de la misma posición (por ejemplo, 16 y 55 en un niño)?
6. **Índice CPO-D:** el plan lo nombra junto al odontograma. ¿Qué códigos cuentan como **C**ariado, **P**erdido y **O**bturado? Por ejemplo, ¿Z y Z1 a Z4 cuentan como obturado? ¿Y Y (ausente) y N (resto radicular) como perdido? Hasta tener esa definición clínica, el sistema **no calcula** el CPO-D; solo guarda los estados.
7. **Colores o símbolos** para marcar cada estado en el dibujo, si usa alguno.

## 10. Fuera de alcance de T-16

- Costos y saldo por tratamiento (columnas COSTO, A Cta. y SALDO de la ficha de tratamientos): el saldo se paga en el consultorio y el sistema no cobra (V-23).
- Anamnesis estructurada con casillas sí/no (la de T-15 es texto libre) y el N.º de historia del consultorio. Se consultan por separado con la doctora.
- Cualquier diagnóstico automático: el sistema solo registra lo que anota la doctora.
