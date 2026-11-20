# Brief base para planificar: Sistema de Gestión de Clínica Dental

> **Para la IA que recibe este documento:** eres el arquitecto y planificador de un sistema nuevo. Este documento es la **base técnica y de método**: stack, estructura, reglas de base de datos, buenas prácticas y ciclo de memoria entre IAs. **Los requerimientos funcionales los envía el propietario aparte** (o pegados en la sección 3). Con ellos debes diseñar el proyecto y **las tablas de la base de datos**.
>
> Reglas para ti:
> - **Los requerimientos del propietario mandan** sobre el catálogo de referencia de la sección 4. Ese catálogo sirve para detectar huecos y hacer preguntas, no para añadir alcance por tu cuenta.
> - Si algo es ambiguo, **pregunta antes de cerrar el modelo de datos**; no inventes requisitos.
> - En esta etapa **no escribas código de implementación**: entrega plan, modelo de datos y roadmap (sección 15). Lo implementará después otro agente (Claude Code) por *vertical slices*.

---

## 1. Contexto

El propietario (DevSure, empresa de desarrollo de software en Santa Cruz de la Sierra, Bolivia) ya construyó un sitio corporativo y una serie de demos por rubro, entre ellos una clínica dental ficticia («Lúmina Dental») cuya experiencia principal es la **reserva de cita**. Ahora quiere un **sistema real de gestión para una clínica / consultorio dental**, construido con el mismo stack, la misma estructura y el mismo ciclo de trabajo entre IAs que DevSure.

Será un repositorio propio, sin dependencias de código con DevSure: solo se reutilizan patrones.

### 1.1 Punto de partida: la demo «Lúmina Dental»

El sistema **parte de la demo existente**. Su código, imágenes, documentos de diseño, plan de pruebas e informe de QA están copiados en **`docs/referencia/lumina-dental/`** de este repositorio, con un `README.md` que explica qué es cada archivo, qué es simulado y qué se puede aprovechar. **Léelo antes de diseñar.**

Lo que aporta la demo:
- **Identidad visual y tono** ya diseñados (editorial clínico en calma, marfil y pino, Fraunces + Figtree, el arco como motivo). El portal público del sistema debe partir de ahí.
- **Flujo de solicitud de cita en 4 pasos** (Motivo → Preferencia → Día y hora → Tus datos), con validaciones y accesibilidad, hoy **simulado** en el navegador. El sistema real debe hacerlo funcionar: disponibilidad real desde la API, solicitud guardada y confirmada por la recepción.
- **Semilla de datos**: motivos de consulta, tratamientos con duración, especialidades y horarios, que pasan a ser catálogos administrables.

Lo que la demo **no** tiene y el sistema debe construir: backend, pacientes, agenda real, historia clínica, odontograma, cobros, usuarios y panel interno. «Lúmina Dental» es una marca ficticia: pregunta al propietario el nombre real de la clínica o si el sistema será genérico para varias clínicas.

En tu plan, indica para cada pieza de la demo si se **reutiliza**, se **adapta** o se **descarta**, y traza los campos de la solicitud de cita de la demo (`AppointmentState`) a las tablas que propongas.

---

## 2. Objetivo

Un sistema que permita a una clínica dental gestionar su operación diaria (pacientes, agenda, atención clínica y lo que el propietario defina) desde:

| Cliente | Tecnología | Uso previsto (a confirmar con los requerimientos) |
|---|---|---|
| **Web system** | **Next.js** | Recepción y odontólogos en la PC: agenda, pacientes, historia clínica, administración, reportes |
| **App móvil** | **React Native (Expo)** | A definir: ¿app del odontólogo (agenda del día, ficha rápida), app del paciente (reservar, ver citas, recordatorios) o ninguna en el MVP? |
| **API** | **NestJS** | Única fuente de datos para ambos clientes |

---

## 3. Requerimientos del propietario

> **Propietario:** pega aquí tus requerimientos o envíalos en el mismo mensaje. **IA:** si esta sección está vacía y no recibiste requerimientos aparte, tu primera respuesta son solo preguntas.

```text
(pendiente)
```

---

## 4. Catálogo de referencia del dominio (no es alcance)

Módulos habituales de un sistema dental. Úsalos para comparar con los requerimientos, señalar lo que falta y preguntar. **Solo entra al MVP lo que el propietario pida.**

| Módulo | Contenido típico |
|---|---|
| **Pacientes** | Datos personales, documento de identidad (CI en Bolivia), contacto, fecha de nacimiento, tutor/responsable si es menor, alergias y alertas médicas visibles en toda la ficha, cómo nos conoció |
| **Agenda y citas** | Calendario por odontólogo y por sillón/consultorio, duración por tipo de cita, estados (programada, confirmada, en sala, atendida, no asistió, cancelada, reprogramada), bloqueos de horario, horarios de atención, evitar solapes |
| **Reserva de citas** | Solicitud desde web/app del paciente, confirmación por la clínica, recordatorios (canal a decidir) |
| **Historia clínica** | Anamnesis (antecedentes médicos, medicación, hábitos), motivo de consulta, evolución por sesión (notas clínicas firmadas por el profesional, no editables después de cerradas; correcciones como adenda) |
| **Odontograma** | Estado por pieza dental (notación FDI: 11–48 adultos, 51–85 temporales) y por cara (oclusal, mesial, distal, vestibular, lingual/palatino), hallazgos y tratamientos realizados/planificados, con historial en el tiempo |
| **Plan de tratamiento y presupuesto** | Procedimientos por pieza, precio, estado (propuesto, aceptado, en curso, terminado), aprobación del paciente |
| **Catálogo de procedimientos** | Nombre, código interno, duración estimada, precio de lista, categoría (preventivo, restaurador, endodoncia, ortodoncia, cirugía, estética…) |
| **Cobros** | Registro manual de pagos y saldos por paciente/plan (efectivo, QR, transferencia, tarjeta). **Pasarela de pago en línea: fuera de alcance salvo requisito aprobado** |
| **Archivos clínicos** | Radiografías, fotos intraorales, consentimientos firmados (PDF/imagen), con acceso restringido |
| **Consentimientos informados** | Plantillas por procedimiento, registro de aceptación |
| **Recetas e indicaciones** | Emisión e impresión/PDF |
| **Inventario de insumos** | Stock, mínimos, consumos (normalmente post-MVP) |
| **Usuarios y roles** | Administrador, odontólogo, asistente, recepción; permisos por rol |
| **Reportes** | Citas por estado, ausentismo, producción por odontólogo, ingresos, pacientes nuevos |
| **Auditoría** | Quién vio o cambió datos clínicos y cuándo |
| **Multisede** | Varias sucursales (normalmente post-MVP; decidir si el modelo lo prepara) |

---

## 5. Requisitos no funcionales base

- **Datos de salud = datos sensibles.** Acceso por rol y mínimo privilegio, registro de auditoría de lectura y escritura en datos clínicos, archivos clínicos nunca públicos (servidos con autorización, no como estáticos abiertos), copias de seguridad automáticas de BD y archivos con prueba de restauración, sitio con `noindex` y sin registro público de personal. Pide al propietario confirmar la normativa boliviana aplicable (salud y protección de datos) y la política de retención de historias clínicas; no la supongas.
- **Notas clínicas inmutables una vez cerradas**: se corrigen con adendas, nunca se sobrescriben ni se borran.
- Español (Bolivia); zona horaria `America/La_Paz`; moneda **BOB** (preparar campo de moneda).
- Agenda rápida: cambiar de día y de odontólogo sin recargas perceptibles.
- Accesible y usable en tablet de recepción.

---

## 6. Stack a reutilizar (probado en DevSure)

### 6.1 Runtime: **Node.js 24 LTS**
- `engines.node: "24.x"`, `packageManager: "pnpm@<versión fijada>"` y `.nvmrc` con 24 desde el día 1.
- Lección del spike de migración de DevSure: `better-sqlite3` 11.x no trae binario para Node 24; usar **12.x o superior** si se usa SQLite. Verificar soporte de Node 24 en cada dependencia y en el VPS.

### 6.2 Tabla de stack

| Capa | Tecnología | Notas |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | `apps/*`, `packages/*`; scripts raíz `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e` |
| Lenguaje | **TypeScript estricto** | `tsconfig` base en `packages/config` |
| Web | **Next.js 15 (App Router) + React 19** | Server Components para datos; Client Components solo con interacción (agenda, odontograma) |
| App móvil | **React Native con Expo + Expo Router** | Solo si los requerimientos la piden; reutiliza `packages/contracts` |
| Estilos | **CSS Modules + tokens CSS** (variables en `:root`, claro/oscuro), mini design system propio (`components/ds`) | Sin framework de UI pesado |
| Backend | **NestJS 11** sobre Express 5 | Un módulo por agregado del dominio |
| ORM / BD | **TypeORM 0.3** con **migraciones siempre y `synchronize: false`** | Motor: ver 7.1 |
| Validación | **class-validator / class-transformer** en DTOs; **Joi** para variables de entorno al arrancar | |
| Contratos | **`packages/contracts`** | DTOs/tipos/enums compartidos api ↔ web ↔ móvil. **Nunca** exponer entidades TypeORM |
| Auth | **Sesión opaca revocable**, secreto hasheado en BD, **Argon2**, rate-limit de login, primer admin por CLI con cambio de contraseña obligatorio, **sin registro público de personal** | Web: cookie `httpOnly` + **CSRF**. Móvil: mismo token en `Authorization: Bearer`, en almacenamiento seguro (`expo-secure-store`). **RBAC** por rol con guards de Nest |
| Seguridad HTTP | **helmet**, CORS por lista blanca, `trust proxy` detrás de un único proxy, filtro global de excepciones que no filtra detalles internos | |
| Archivos | **multer**, nombre UUID inmutable; los archivos clínicos se sirven por un endpoint autenticado, **no** como estáticos públicos | |
| Docs API | **Swagger** activable por variable de entorno (desactivado en producción) | |
| Tests | **Jest + supertest** (api unit + integración), **node:test** (web estructura), **Vitest** (contracts), **Playwright** (E2E web, Chromium), **Jest + React Native Testing Library** (app) | |
| Calidad | ESLint + Prettier compartidos | |
| Deploy | **VPS Linux** (Nginx, Node 24), despliegue manual por script (`deploy-vps.sh`: fetch fast-forward de `main`, backup de BD y archivos, install, build, migraciones, restart) | |

---

## 7. Reglas de diseño de la base de datos

### 7.1 Motor
DevSure usa **SQLite (`better-sqlite3`)** con código portable a PostgreSQL. Para un sistema clínico multiusuario (recepción + varios odontólogos escribiendo a la vez, auditoría, crecimiento de archivos y registros), **evalúa si conviene PostgreSQL desde el inicio** y decídelo en un ADR. En ambos casos: nada de SQL exclusivo del motor fuera de las migraciones.

### 7.2 Convenciones
- Tablas y columnas en **inglés, `snake_case`**, tablas en singular o plural (elige una y aplícala siempre); la UI en español.
- **Clave primaria** consistente (UUID o entero autoincremental: decídelo en un ADR; si habrá app con offline o sincronización, UUID).
- En toda tabla de negocio: `created_at`, `updated_at` (UTC), `created_by` / `updated_by` cuando aplique.
- **Borrado lógico** (`archived_at` / `deleted_at`) para pacientes, citas, planes y catálogos; **nunca** borrado físico de datos clínicos.
- **Dinero** como entero en centavos (`amount_cents`) + `currency` (`BOB`); nunca `float`.
- **Fechas**: instantes en UTC; fechas sin hora (nacimiento) como `date`; la agenda se muestra en `America/La_Paz`.
- **Enums** como texto con `CHECK` o tabla de catálogo si el propietario debe poder editarlos; el enum vive también en `packages/contracts`.
- **Claves foráneas explícitas** con índice y regla `ON DELETE` pensada (normalmente `RESTRICT` en datos clínicos).
- **Índices** para las consultas frecuentes: citas por `(dentist_id, starts_at)`, por `(patient_id, starts_at)`; pacientes por documento y por nombre; restricción o validación contra **solapes de citas** del mismo odontólogo/sillón.
- **Unicidad** de negocio: documento de identidad por paciente (considerando extranjeros y menores sin CI), código de procedimiento, email de usuario.
- **Historial / auditoría**: tabla `audit_log` (actor, acción, entidad, id, cambios, fecha, IP) para datos clínicos; los cambios de estado de cita y de tratamiento con su propia tabla de historial.
- **Precio congelado**: el ítem de un plan o cobro guarda el precio del momento, no solo la referencia al catálogo.
- Cada cambio de esquema = **una migración con su test**; seeds para catálogos (procedimientos, piezas dentales FDI, roles) y para el primer administrador.

### 7.3 Entregable del modelo
Para cada tabla: propósito, columnas (tipo, nulo, default, restricción), PK, FKs, índices, unicidades y a qué requerimiento responde. Más un **diagrama ER en Mermaid** (`erDiagram`) y la lista de enums.

---

## 8. Estructura de carpetas propuesta

```text
sistema-dental/
├── AGENTS.md
├── README.md
├── package.json               # engines node 24.x, packageManager pnpm, scripts vía turbo
├── .nvmrc                     # 24
├── pnpm-workspace.yaml
├── turbo.json
├── apps/
│   ├── api/                   # NestJS
│   │   └── src/
│   │       ├── main.ts / bootstrap.ts   # helmet, CORS, prefijo /api/v1, pipes, filtros
│   │       ├── config/                  # configuration.ts + env.validation.ts (Joi)
│   │       ├── common/                  # filtros, guards de rol, validadores, auditoría
│   │       ├── database/{data-source.ts,migrations/,seeds/}
│   │       ├── auth/  users/
│   │       ├── patients/                # entities/, dto/, service, controller, spec
│   │       ├── appointments/
│   │       ├── clinical-records/        # anamnesis, evoluciones, adendas
│   │       ├── odontogram/
│   │       ├── treatments/              # catálogo, planes, presupuestos
│   │       ├── payments/
│   │       ├── files/                   # archivos clínicos con acceso autorizado
│   │       ├── reports/  audit/  health/
│   │       └── …                        # según requerimientos
│   ├── web/                   # Next.js
│   │   └── src/
│   │       ├── app/                     # /login, /agenda, /pacientes, /pacientes/[id], /tratamientos, /caja, /reportes, /ajustes
│   │       ├── components/ds/
│   │       ├── features/{agenda,patients,clinical,odontogram,treatments,payments,reports,admin}/
│   │       └── lib/
│   └── mobile/                # React Native (Expo), solo si se aprueba
├── packages/
│   ├── config/                # eslint, prettier, tsconfig base
│   ├── contracts/             # DTOs / tipos / enums compartidos
│   └── domain/ (opcional)     # lógica pura: piezas FDI, transiciones de estado, cálculo de saldos
├── docs/
│   ├── PLAN.md
│   ├── DATA-MODEL.md          # modelo de datos + ER en Mermaid
│   ├── adr/
│   ├── referencia/
│   │   └── lumina-dental/     # copia de la demo de DevSure (solo lectura, ver 1.1)
│   └── ai/                    # memoria versionada entre IAs (sección 10)
└── scripts/
    └── deploy-vps.sh
```

Convención por módulo de API: `x.module.ts`, `x.service.ts`, `x.service.spec.ts`, `x.controller.ts`, `dto/`, `entities/`. Por feature: carpeta propia con `components/`, `api/` y, si es complejo (agenda, odontograma), un `MODULE.md`.

---

## 9. Buenas prácticas a conservar

1. **Vertical slices pequeños y revisables**: contrato → migración → API → UI → tests en cada slice.
2. **Contratos primero** en `packages/contracts`.
3. **Migraciones con test**, nunca `synchronize`.
4. **Entidades ≠ DTOs públicos**: mapear siempre.
5. **Validar entorno al arrancar** y **nunca** poner secretos, tokens, hashes ni datos de pacientes en código, logs, respuestas de error o fixtures reales. Seeds y tests con **datos ficticios**.
6. **Errores seguros**: filtro global con mensajes genéricos; detalle solo en el log del servidor, sin datos clínicos.
7. **Accesibilidad**: foco visible, etiquetas, contraste, objetivos táctiles grandes.
8. **Definition of Done** por slice: lint, typecheck, unit, integración, E2E del recorrido tocado (Chromium) y build de producción en verde. Lo no ejecutado se reporta como **NOT EXECUTED**, nunca como PASS.
9. **No añadir dependencias ni integraciones externas** (WhatsApp/SMS, pasarelas de pago, facturación electrónica, IA) sin requisito aprobado.
10. **Respetar los ADR aceptados**; cambiarlos exige un ADR nuevo aprobado.

---

## 10. Ciclo de memoria entre IAs (igual que en DevSure)

**La memoria del proyecto son los documentos versionados y Git. Ninguna IA depende del historial de conversaciones.** La memoria local de cada herramienta guarda preferencias personales, nunca hechos del proyecto.

### 10.1 Flujo

```text
ChatGPT        planifica → docs/ai/ROADMAP.md (EPIC / PHASE / TASK + criterios de aceptación)
   ↓
Claude Code    implementa la TASK asignada
   ↓
Codex          revisa (review / adversarial) cuando aporta valor
   ↓
Tests          build · lint · typecheck · unit · integración · E2E
   ↓
Claude Code    cierre: actualiza STATUS.md y HANDOFF.md y resume al propietario
   ↓
Propietario    revisa y autoriza (sin autorización no hay commit)
   ↓
Claude Code    commit → push a Forgejo (repositorio canónico; nunca push directo a GitHub)
   ↓
Forgejo        push mirror automático a GitHub (solo lectura)
   ↓
ChatGPT        lee el estado real desde GitHub (código + docs/ai) y decide la siguiente TASK
```

### 10.2 Documentos y su dueño (cada hecho tiene un solo dueño; los demás enlazan)

| Documento | Qué guarda |
|---|---|
| `AGENTS.md` (raíz) | Reglas persistentes del proyecto |
| `docs/ai/PROTOCOL.md` | Proceso: bootstrap, cierre, recuperación, validación, anti-alucinación |
| `docs/ai/MASTER.md` | Visión, arquitectura, roles de cada IA, jerarquía de fuentes de verdad, sistema de memoria |
| `docs/ai/DECISIONS.md` (+ `docs/adr/`) | ADRs y su vigencia |
| `docs/ai/ROADMAP.md` | Trabajo planificado (lo escribe ChatGPT) |
| `docs/ai/STATUS.md` | «Estado vigente»: estado real del proyecto y prioridad |
| `docs/ai/HANDOFF.md` | «Resumen de continuidad» (≤ 25 líneas) + detalle de la última entrega |
| `MODULE.md` | Contrato de un módulo, junto a su código |

### 10.3 Reglas clave
- **Bootstrap por niveles** al iniciar una tarea: nivel 0 siempre (`AGENTS.md`, `PROTOCOL.md`, `MASTER.md`, «Estado vigente», «Resumen de continuidad»); nivel 1 según la tarea (su entrada del roadmap, ADRs aplicables, `MODULE.md`); nivel 2 solo con motivo concreto.
- **Comprobaciones de Git antes de editar**: `HEAD`, `origin/main`, cambios locales; reportar divergencias antes de tocar nada.
- **Regla del snapshot (`as_of_sha`)**: `STATUS.md` y `HANDOFF.md` declaran el SHA de `HEAD` observado al redactar, fecha/hora, procedencia y autorizaciones pendientes; no afirman estados posteriores (commit, push, deploy): quien lea después lo mide con Git.
- **Matriz de cierre**: toda tarea que se versiona actualiza `STATUS.md` y `HANDOFF.md`; `MODULE.md`, `DECISIONS.md`, `ROADMAP.md` y `docs/DATA-MODEL.md` solo si cambió lo que registran.
- **Estados del trabajo distintos**: planned ≠ implemented ≠ verified ≠ committed ≠ pushed ≠ deployed ≠ release approved.
- **Autorizaciones separadas**: stage, commit, push y deploy requieren autorización explícita del propietario, cada una.
- **Jerarquía de verdad**: para «qué existe hoy», código > evidencia de tests > Git > `STATUS.md`; para «qué se decidió», `DECISIONS.md` > `MASTER.md` > `ROADMAP.md`. Si el código contradice un ADR, se registra como desviación; no se reemplaza en silencio.
- **Regla no negociable**: *Never invent project state. Verify before asserting.* No presentar informes de otra IA como pruebas ejecutadas por uno mismo.

### 10.4 Repositorio
- **Forgejo propio** = canónico (remote `origin`); **GitHub** = mirror privado de solo lectura alimentado por el push mirror de Forgejo, para que ChatGPT lo lea. GitHub Actions desactivado en el mirror.
- Desplegar solo tras confirmar que el push llegó a Forgejo (`git ls-remote origin refs/heads/main`).

---

## 11. Lecciones aprendidas en DevSure

- Registrar **CORS antes** de servir archivos; si no, las imágenes pedidas con `crossOrigin` fallan en silencio.
- No hacer que un layout global dependa de la API si hay rutas que no la necesitan.
- Documentar desviaciones de alcance en el momento, con ADR.
- E2E completas son lentas: suites por recorrido y correr solo la del slice en cada cambio.
- Fijar Node (`engines`, `.nvmrc`) y pnpm (`packageManager`) desde el día 1; dependencias nativas con binario para Node 24.
- El token del mirror Forgejo → GitHub caduca y la sincronización se detiene sin avisar: anotar su caducidad.

---

## 12. API: convenciones

- Prefijo `/api/v1`, REST, recursos en plural (`/patients`, `/appointments`, `/patients/:id/clinical-notes`…).
- Listados paginados (`page`, `pageSize` o cursor) con filtros explícitos; la agenda por rango (`from`, `to`, `dentistId`).
- Cambios de estado como acciones explícitas (`POST /appointments/:id/status`) que dejan historial.
- Todo detrás de sesión y rol; solo `login`, `health` y, si se aprueba, la **solicitud pública de cita** son públicos (esta última con rate-limit y validación anti-spam).
- La API exacta la defines tú a partir de los requerimientos.

---

## 13. Fuera de alcance salvo requisito aprobado

Pasarela de pago en línea, facturación electrónica (SIAT), WhatsApp/SMS automáticos, videoconsulta, IA clínica, integración con seguros, multisede, publicación en tiendas de apps, WebSockets, microservicios.

---

## 14. Decisiones abiertas que debes resolver o preguntar

1. **SQLite vs PostgreSQL** desde el inicio (sección 7.1).
2. **UUID vs entero** como clave primaria.
3. **App móvil**: ¿para quién (odontólogo, paciente o ninguno en el MVP)?
4. **Roles y permisos** exactos; ¿un odontólogo ve las historias de pacientes de otros odontólogos?
5. **Odontograma**: nivel de detalle (pieza o pieza + cara), notación y catálogo de hallazgos.
6. **Reserva pública de citas**: ¿existe en el MVP? ¿requiere confirmación manual?
7. **Recordatorios** de cita: ¿canal? (fuera de alcance si implica integración externa no aprobada).
8. **Cobros**: ¿pagos parciales, anticipos, descuentos, varios odontólogos con comisión?
9. **Normativa y retención** de historias clínicas y consentimientos.
10. Dominio/subdominio y si se despliega en el mismo VPS que DevSure.

---

## 15. Lo que te pido que entregues

1. **Preguntas** al propietario (máx. 10, concretas) sobre lo que los requerimientos no cubran.
2. `docs/PLAN.md`: visión, alcance MVP / post-MVP **trazado a cada requerimiento**, arquitectura, pantallas (wireframes en texto), roles y permisos, riesgos.
3. `docs/DATA-MODEL.md`: **todas las tablas** con el detalle de 7.3, diagrama ER en Mermaid, enums, índices, seeds y el orden de las migraciones iniciales.
4. **ADRs iniciales** en `docs/ai/DECISIONS.md` (formato: Status, Date, Context, Decision, Reasoning, Consequences, Affected areas) para las decisiones de la sección 14, más uno para **Node 24** y otro para el **ciclo de memoria / Forgejo canónico / GitHub mirror**.
5. `docs/ai/ROADMAP.md` con **EPIC / PHASE / TASK**, cada TASK con criterios de aceptación verificables y pensada como vertical slice. Orden orientativo (ajústalo a los requerimientos):
   - Fase 0: fundaciones (monorepo Node 24, config compartida, api con health, web con layout, scripts lint/typecheck/test/build en verde, `docs/ai/` inicializado).
   - Fase 1: auth, usuarios y roles; auditoría base.
   - Fase 2: pacientes.
   - Fase 3: agenda y citas.
   - Fase 4: historia clínica y odontograma.
   - Fase 5: tratamientos, presupuestos y cobros.
   - Fase 6: archivos clínicos, reportes; app móvil si se aprobó.
   - Fase 7: endurecimiento, backups probados, E2E y despliegue en VPS.
6. Versiones iniciales de `AGENTS.md`, `docs/ai/PROTOCOL.md` y `docs/ai/MASTER.md`, con `STATUS.md` y `HANDOFF.md` vacíos pero con su estructura (`as_of_sha`, captura, procedencia, siguiente paso, autorizaciones pendientes).

No escribas código de implementación en esta etapa.
