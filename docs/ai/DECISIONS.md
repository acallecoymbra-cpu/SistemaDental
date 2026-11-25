# DECISIONS — ADR iniciales / propuestas

**Regla:** `Propuesta` no significa `Aceptada`. Las decisiones del dueño o cliente se registran aquí o en un ADR dedicado, con fecha y evidencia. Cambios a ADR aceptado requieren nuevo ADR.

## ADR-001 — Persistencia PostgreSQL
- **Status:** ACEPTADA (motor) por el cliente, 2026-11-20 (V-13 de `docs/VALIDACION-REQUISITOS.md`); TypeORM/migraciones pendiente de aprobación del propietario. **Date:** 2026-11-20.
- **Context:** franja fija de 45 min (V-20), reserva que aparta la franja 8 min (V-21), confirmación de pago concurrente y RNF-07 de no solapes.
- **Decision:** considerar PostgreSQL como motor inicial; TypeORM 0.3 con migraciones y `synchronize=false`.
- **Reasoning:** transacciones y restricciones de exclusión robustas para franjas concurrentes.
- **Consequences:** operar PostgreSQL/backup y test de integración real; no asumir servicios existentes.
- **Affected:** API, DB, CI, operaciones. **Aprobar:** propietario.
- **Implementación (B-02, 2026-11-25):** PostgreSQL 17 (`postgres:17-bookworm`) en Docker Compose para desarrollo y como servicio en la CI; TypeORM 0.3.31 + `pg` 8.23.1; tabla de control `schema_migrations`; conexión en UTC; extensión `btree_gist` en la primera migración.

## ADR-002 — Identificadores UUID y valores monetarios
- **Status:** Propuesta; **Date:** 2026-11-20.
- **Decision:** UUID como PK; `amount_cents` entero + `currency='BOB'` en importes monetarios; instantes en UTC, vistas en `America/La_Paz`.
- **Reasoning:** consistencia técnica, no exponer IDs incrementales, evitar errores decimales.
- **Consequences:** tipos/contracts y migraciones compartidas. **Aprobar:** propietario.

## ADR-003 — Identidad del paciente sin cuenta
- **Status:** ACEPTADA por el cliente, 2026-11-20 (V-01, V-02). **Date:** 2026-11-20.
- **Context:** CU-03 permite ver citas usando nombre y celular, con rate limit, pero no verifica posesión.
- **Decision:** identificación solo con nombre + celular, **sin OTP ni código**. El paciente ve únicamente sus consultas, nunca historial clínico. Al agendar se pregunta si ya está registrado; si no, registra datos con fecha de nacimiento; menor de edad ⇒ celular de padre/madre obligatorio. Mismo celular con distinto nombre = pacientes distintos.
- **Reasoning:** decisión del cliente; prioriza simplicidad sobre verificación de posesión.
- **Consequences:** riesgo residual de que un tercero que conozca nombre y celular vea consultas ajenas (aceptado); mitigación por rate limit RF-09 y respuestas mínimas. Menores (V-18): etiqueta de menor y consulta con el celular del apoderado.

## ADR-004 — Una clínica, un dentista y web como único cliente MVP
- **Status:** ACEPTADA por el cliente, 2026-11-20 (V-13: sistema web, una sola clínica, «Renovando Sonrisas»).
- **Context:** v4.2 excluye segundo profesional, recepcionista y cuentas.
- **Decision:** web responsiva Next.js + API NestJS; no crear app Expo en MVP. Permisos del único dentista y rutas públicas para pacientes.
- **Reasoning:** respetar alcance, evitar arquitectura sobredimensionada.
- **Consequences:** paso de selección de especialidad de la demo se elimina/adapta. **Aprobar:** cliente.

## ADR-005 — Estado y reserva de consulta
- **Status:** ACEPTADA por el cliente (V-05…V-09, V-15, V-17, V-20…V-23; última ronda registrada 2026-11-23). **Supera** al Word v4.2 en estados y en el momento del bloqueo.
- **Decision:** **cinco estados**: `por_pagar`, `confirmada`, `completada`, `cancelada`, `no_asistio` (se elimina `pago_en_revision`). **Reserva tipo butaca:** la `por_pagar` aparta la franja desde su creación durante 8 min; sin comprobante en ese plazo se cancela; con comprobante sigue apartada hasta que el dentista confirme. Ocupan franja: `por_pagar` vigente, `confirmada`, `completada`, `no_asistio`. Franja fija de **45 min**, inicios cada 45 min, desde el día siguiente. Nunca rechazar pago en UI. Anticipo único 10–20 Bs sobre consulta de 30 Bs, sin devolución; saldo en el consultorio.
- **Reasoning:** respuestas del cliente; RF-17/18 y RNF-07.
- **Consequences:** la restricción de exclusión actúa al **crear** la reserva; las reservas vencidas se cancelan dentro de la misma transacción antes de insertar y por un job cada minuto. Un paciente que pague tarde (pasados 8 min) pierde la reserva y lo resuelve por WhatsApp.

## ADR-006 — Stack, Node.js 24 y contratos
- **Status:** Propuesta tomada del brief.
- **Decision:** Node 24 LTS, pnpm/Turborepo, Next.js 15/React 19, NestJS 11, TypeORM 0.3, TS estricto, contracts/DTO compartidos, test unit/integration/E2E.
- **Reasoning:** reutilizar patrones probados por DevSure.
- **Consequences:** fijar versiones y verificar compatibilidad real en instalación. **Aprobar:** propietario.
- **Versiones fijadas en TASK-002 (2026-11-23):** Node 24.22.3 (`engines` 24.x), pnpm 12.18.0, Turborepo 2.11.13, TypeScript 5.9.3, NestJS 11.2.11, Next.js 15.5.29, React 19.1.10, Jest 30.5.2 + ts-jest 29.4.15 + supertest 7.3.2, Vitest 5.1.1, ESLint 9.39.5 + typescript-eslint 8.73.0, Prettier 3.10.1. Desvíos frente a lo más reciente, para respetar el brief: NestJS 12 y TypeScript 7 existen pero no se usan; ESLint 9 figura como deprecado frente a 10, pero se mantiene por compatibilidad con Next 15; typescript-eslint 8.74.0 se descartó por la política de antigüedad mínima de pnpm (publicado el mismo día).

## ADR-007 — Memoria Git y responsabilidades de IA
- **Status:** Propuesta tomada del brief.
- **Decision:** ChatGPT planifica, Claude Code implementa, Codex audita cuando aporta valor; memoria en `AGENTS.md` y `docs/ai/*`, snapshot SHA y autorizaciones de Git independientes.
- **Reasoning:** continuidad auditable sin contexto privado de una IA.
- **Consequences:** cada entrega versionada actualiza STATUS/HANDOFF. **Aprobar:** propietario.

## ADR-008 — Repositorios y visibilidad
- **Status:** PARCIALMENTE ACEPTADA (2026-11-20). Visibilidad **pública**: ACEPTADA y **ratificada** por el propietario tras la respuesta V-13 del cliente (que pedía espejo privado); prevalece la decisión del propietario. Forgejo principal + GitHub espejo: ACEPTADO por el cliente (V-13), configuración pendiente.
- **Context:** brief indica Forgejo canónico + GitHub mirror privado, pero GitHub observado es público, rama main, con commit inicial. Forgejo no configurado como remoto.
- **Decision (aceptada por el propietario, 2026-11-20, instrucción directa en sesión de Claude Code):** el repositorio GitHub `acallecoymbra-cpu/SistemaDental` **permanece público**. El documento de requisitos `Doc_Dentista_v4.2.docx` **no se versiona** en el repositorio. Esto se desvía del brief §10.4 («mirror privado»).
- **Pendiente:** configurar Forgejo como canónico. No cambiar remotos ni visibilidad sin orden expresa.
- **Reasoning:** decisión del propietario; la documentación de planificación no contiene datos de pacientes.
- **Consequences:** todo lo versionado es público. Prohibido en Git: datos reales de pacientes, archivos clínicos, secretos, credenciales y el documento de requisitos del cliente. Revisar cada STAGE con este criterio. **Aprobar (pendiente):** propietario.

## ADR-009 — Historial clínico
- **Status:** Propuesta alineada con v4.2. Nomenclatura **FDI** e índice **CPO-D** ACEPTADOS por el cliente (V-19, 2026-11-20); catálogo de estados de pieza pendiente.
- **Decision:** versiones append-only de anamnesis/odontograma/índice/diagnóstico; dentista único autor; lectura de versiones anteriores.
- **Reasoning:** RF-24/25 y RD-01.
- **Consequences:** requiere reglas de comparación de versiones, nomenclatura y catálogo de piezas/estados aprobados. **Aprobar:** dentista.

## ADR-010 — Retención, correo y backups
- **Status:** ACEPTADA (valores RNF) por el cliente, 2026-11-20 (V-12). Plazo concreto de retención clínica: pendiente de asesoría local.
- **Decision:** preparar outbox de cancelación e infraestructura de backups restaurables; definir retención con validación de cliente y asesor local.
- **Reasoning:** disponibilidad y trazabilidad de datos de salud.
- **Consequences:** costos/operación según proveedor de email, almacenamiento y VPS.

## ADR-011 — Protección CSRF y forma de los errores de la API
- **Status:** ACEPTADA por el propietario (2026-11-25); implementada en B-03.
- **Context:** el panel del dentista usará sesión por cookie (ADR del brief); una cookie se envía sola desde cualquier sitio, lo que habilita CSRF. Los errores no deben filtrar detalles internos ni datos personales.
- **Decision:** (1) toda petición que modifica datos (POST/PUT/PATCH/DELETE) debe traer `Origin` (o `Referer`) de la lista `WEB_ORIGINS`; si no, 403. Se complementa en B-04 con cookies `httpOnly`, `Secure` y `SameSite=Lax`. (2) CORS solo para `WEB_ORIGINS`, con credenciales. (3) Toda respuesta de error usa `ApiErrorResponse` (`statusCode`, `error`, `message`, `requestId`); los 5xx responden un mensaje genérico y el detalle va solo al log, sin cuerpo ni cabeceras. (4) DTOs con `ValidationPipe` en lista blanca estricta (`forbidNonWhitelisted`).
- **Reasoning:** la verificación de origen es simple, no requiere token en cada formulario y los navegadores actuales siempre envían `Origin` en peticiones que modifican datos; el `requestId` permite al dentista reportar un error sin exponer nada.
- **Consequences:** clientes sin navegador (scripts, Postman) deben enviar `Origin`; si en el futuro hay app móvil con token Bearer, se revisa esta ADR. Nuevas variables obligatorias: `WEB_ORIGINS` (y opcional `TRUST_PROXY`).

## Registro de cambios

| Fecha | Estado | Autor | Resumen |
|---|---|---|---|
| 2026-11-20 | Propuestas iniciales | ChatGPT, revisión de fuentes | Documento base sin aprobación ni modificación del repositorio |
| 2026-11-20 | ADR-008 parcialmente aceptada | Propietario (registrado por Claude Code) | GitHub sigue público; `.docx` de requisitos fuera del repositorio; canónico/Forgejo pendiente |
| 2026-11-20 | ADR-001/003/004/010 aceptadas; ADR-005 parcialmente; ADR-008: Forgejo principal aceptado | Cliente (respuestas V-01…V-13, registradas por Claude Code) | Ver `docs/VALIDACION-REQUISITOS.md` §6 |
| 2026-11-20 | ADR-008 visibilidad ratificada | Propietario (instrucción directa en sesión de Claude Code) | GitHub sigue **público** por el momento pese a V-13 («espejo privado»); el cliente está informado |
| 2026-11-20 | Segunda ronda: ADR-003 menores, ADR-005 sin devolución y vencimiento, ADR-009 FDI/CPO-D; conflicto V-16 | Cliente por WhatsApp (registrado por Claude Code el 2026-11-23) | Ver `docs/VALIDACION-REQUISITOS.md` §6.2 |
| 2026-11-23 | Tercera ronda: ADR-005 aceptada (5 estados, franja 45 min, reserva de 8 min, saldo en consultorio) | Cliente por WhatsApp (registrado por Claude Code) | Ver `docs/VALIDACION-REQUISITOS.md` §6.3 |
| 2026-11-25 | Reparto de trabajo aprobado | Propietario (instrucción directa en sesión de Claude Code) | Base B-01…B-06 por propietario/Claude Code; tareas T-01…T-18 por la alumna; ver `docs/PLAN-IMPLEMENTACION.md` |
| 2026-11-25 | ADR-011 aceptada | Propietario (instrucción directa en sesión de Claude Code) | CSRF por verificación de origen + forma única de errores de la API |
