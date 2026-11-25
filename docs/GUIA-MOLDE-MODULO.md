# Guía del molde: cómo construir un módulo nuevo

**Para:** quien implementa las tareas T-01…T-18 de `docs/PLAN-IMPLEMENTACION.md`.
**Molde:** el catálogo de tratamientos (B-05). Es un ejemplo completo y probado de punta a punta: base de datos → API → pantalla → pruebas. Cada tarea nueva copia su estructura y cambia el contenido.

> Regla de oro: si dudas cómo hacer algo, mira cómo lo hace `treatments`. Si el molde no cubre tu caso, pregunta antes de inventar un patrón nuevo.

---

## 1. Mapa del molde (qué archivo hace qué)

| Capa | Archivo del molde | Para qué sirve |
|---|---|---|
| Contrato | `packages/contracts/src/treatments.ts` | Tipos y límites que comparten API y web (`AdminTreatment`, `TREATMENT_NAME_MAX_LENGTH`…) |
| Base de datos | `apps/api/src/database/migrations/1764300000000-CreateTreatments.ts` | Crea la tabla, sus restricciones y la semilla |
| Entidad | `apps/api/src/treatments/treatment.entity.ts` | Describe la tabla para TypeORM |
| Validación | `apps/api/src/treatments/treatment.dto.ts` | Forma validada del cuerpo de cada petición |
| Lógica | `apps/api/src/treatments/treatments.service.ts` | Reglas de negocio, transacciones y auditoría |
| Rutas | `apps/api/src/treatments/treatments.controller.ts` | Endpoints públicos (`@Public()`) y del panel (`/admin/...`) |
| Módulo | `apps/api/src/treatments/treatments.module.ts` | Junta controladores y servicio; se registra en `app.module.ts` |
| Prueba API | `apps/api/test/integration/treatments.int-spec.ts` | Integración contra PostgreSQL real |
| Llamadas web | `apps/web/src/features/treatments/api.ts` | Funciones que llaman a la API desde el navegador |
| Formulario | `apps/web/src/features/treatments/TreatmentForm.tsx` | Crear y editar, con errores de la API |
| Pantalla | `apps/web/src/app/panel/(app)/tratamientos/page.tsx` | Página del panel |
| Portal | `apps/web/src/app/page.tsx` | Ejemplo de página pública con datos del servidor |
| Prueba E2E | `apps/web/e2e/treatments.e2e.ts` | Recorrido real en el navegador (escritorio y 360 px) |

Piezas ya hechas que **solo se usan** (no se copian): login y sesión (`auth`), auditoría (`AuditService`), seguridad HTTP (`bootstrap.ts`), cliente de API web (`apiFetch`), `ErrorAlert`, estilos (`globals.css`) y las utilidades de prueba (`test/integration/helpers.ts`, `e2e/helpers.ts`).

---

## 2. Paso a paso para un módulo nuevo

Ejemplo: T-02 «Intervalos de atención» (`availability_interval`).

### Paso 1 · Contrato

Crea `packages/contracts/src/availability.ts` con los tipos de respuesta y de petición, y las constantes de límites. Expórtalo en `packages/contracts/src/index.ts`. Corre `pnpm build` para que la API y la web lo vean.

### Paso 2 · Migración

```bash
pnpm --filter @sistema-dental/api migration:create src/database/migrations/CreateAvailabilityIntervals
```

- Escribe el SQL a mano en `up()` y lo contrario en `down()`.
- Restricciones **en la base** (no solo en el código): `NOT NULL`, `CHECK`, `UNIQUE`, claves foráneas.
- Revisa la tabla en `docs/DATA-MODEL.md` antes de escribir.
- Nunca edites una migración ya subida a `main`: crea una nueva.

### Paso 3 · Entidad, DTO, servicio, controlador, módulo

Copia la carpeta `apps/api/src/treatments/` con el nombre nuevo y adapta:

- **Entidad:** columnas en `snake_case` en la base (`name: 'created_at'`) y `camelCase` en TypeScript.
- **DTO:** cada campo con sus validaciones (`@IsString`, `@MaxLength`…) y mensajes en español. Lo que no esté en el DTO se rechaza solo.
- **Servicio:**
  - Toda escritura va en `dataSource.transaction(...)` **junto con** `this.audit.record(...)`.
  - Errores esperados → `NotFoundException` (404), `ConflictException` (409), `BadRequestException` (400).
  - Nunca borres registros: desactiva o cambia de estado.
  - Si necesitas devolver un error **y** guardar algo (como un intento fallido), no lances el error dentro de la transacción (ver `auth.service.ts`).
- **Controlador:**
  - Rutas del panel en `admin/...`, **sin** `@Public()`: el guard global exige sesión.
  - Solo marca `@Public()` lo que el paciente debe ver, y devuelve datos mínimos.
  - IDs con `ParseUUIDPipe`.
- **Módulo:** agrégalo a `imports` en `apps/api/src/app.module.ts`.

### Paso 4 · Prueba de integración

Copia `treatments.int-spec.ts`. Como mínimo prueba:

- [ ] rutas del panel sin sesión → 401;
- [ ] caso feliz de cada endpoint;
- [ ] validaciones → 400; no encontrado → 404; duplicado → 409 (si aplica);
- [ ] cada escritura deja su fila en `audit_log`;
- [ ] las reglas de negocio de la tarjeta (por ejemplo, «dos intervalos del mismo día no se superponen»).

```bash
pnpm db:up
pnpm test:integration
```

### Paso 5 · Web

1. `apps/web/src/features/<modulo>/api.ts`: funciones con `apiFetch` y los tipos de `contracts`.
2. Formulario en `features/<modulo>/`: copia `TreatmentForm.tsx` (límites desde `contracts`, botón desactivado al enviar, `<ErrorAlert>`).
3. Página en `apps/web/src/app/panel/(app)/<seccion>/page.tsx` y su enlace en el menú de `panel/(app)/layout.tsx`.
4. Textos en español. Revisa a 360 px de ancho (la tabla ya se adapta con `data-label`).

### Paso 6 · Prueba E2E

Copia `apps/web/e2e/treatments.e2e.ts`: inicia sesión con `loginAsDentist`, recorre el flujo principal y verifica el resultado en pantalla. Usa `uniqueName` para los datos que crees.

```bash
pnpm build
pnpm test:e2e
```

### Paso 7 · Antes del Pull Request

```bash
pnpm exec prettier --write .
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

Completa la plantilla del Pull Request de `docs/PLAN-IMPLEMENTACION.md` §6.

---

## 3. Errores comunes (y cómo evitarlos)

| Error | Cómo evitarlo |
|---|---|
| Endpoint del panel accesible sin sesión | No uses `@Public()` en rutas `admin/...`; pruébalo con un 401 |
| Validación solo en la pantalla | La API valida siempre (DTO + restricciones de la base); la pantalla solo ayuda |
| Cambiar la base sin migración | `synchronize` está en `false`: sin migración, la tabla no existe |
| Auditoría fuera de la transacción | Pasa el `manager` de la transacción a `audit.record(...)` |
| Guardar datos sensibles en la auditoría | Solo los campos que cambian, nunca contraseñas ni contenido clínico completo |
| Devolver la entidad TypeORM directamente | Convierte siempre a un tipo de `contracts` (`toAdminTreatment`) |
| Datos reales de pacientes en pruebas | Solo datos inventados: el repositorio es público |
| Lógica duplicada en API y web | Constantes y tipos en `contracts` |

---

## 4. Comandos útiles

| Comando | Qué hace |
|---|---|
| `pnpm db:up` / `pnpm db:down` | Levanta o detiene PostgreSQL local |
| `pnpm db:migrate` | Aplica migraciones a la base de desarrollo |
| `pnpm --filter @sistema-dental/api migration:revert` | Revierte la última migración (desarrollo) |
| `pnpm --filter @sistema-dental/api dentist:create --username … --name "…"` | Crea el dentista de desarrollo |
| `pnpm dev` | API en `:3001` y web en `:3000` |
| `pnpm test:integration` | Pruebas contra PostgreSQL (base `*_test`) |
| `pnpm test:e2e` | Playwright (base `*_e2e`, puertos `:3100`/`:3101`) |
