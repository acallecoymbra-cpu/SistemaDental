# DECISIONS — ADR iniciales / propuestas

**Regla:** `Propuesta` no significa `Aceptada`. Las decisiones del dueño o cliente se registran aquí o en un ADR dedicado, con fecha y evidencia. Cambios a ADR aceptado requieren nuevo ADR.

## ADR-001 — Persistencia PostgreSQL
- **Status:** ACEPTADA (motor) por el cliente, 2026-11-20 (V-13 de `docs/VALIDACION-REQUISITOS.md`); TypeORM/migraciones pendiente de aprobación del propietario. **Date:** 2026-11-20.
- **Context:** cita de duración fija (90 o 45 min, pendiente V-05b), confirmación de pago concurrente y RNF-07 de no solapes.
- **Decision:** considerar PostgreSQL como motor inicial; TypeORM 0.3 con migraciones y `synchronize=false`.
- **Reasoning:** transacciones y restricciones de exclusión robustas para franjas concurrentes.
- **Consequences:** operar PostgreSQL/backup y test de integración real; no asumir servicios existentes.
- **Affected:** API, DB, CI, operaciones. **Aprobar:** propietario.

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
- **Consequences:** riesgo residual de que un tercero que conozca nombre y celular vea consultas ajenas (aceptado); mitigación por rate limit RF-09 y respuestas mínimas. Pendiente: qué celular identifica a un menor.

## ADR-004 — Una clínica, un dentista y web como único cliente MVP
- **Status:** ACEPTADA por el cliente, 2026-11-20 (V-13: sistema web, una sola clínica, «Renovando Sonrisas»).
- **Context:** v4.2 excluye segundo profesional, recepcionista y cuentas.
- **Decision:** web responsiva Next.js + API NestJS; no crear app Expo en MVP. Permisos del único dentista y rutas públicas para pacientes.
- **Reasoning:** respetar alcance, evitar arquitectura sobredimensionada.
- **Consequences:** paso de selección de especialidad de la demo se elimina/adapta. **Aprobar:** cliente.

## ADR-005 — Estado y reserva de consulta
- **Status:** ACEPTADA parcialmente por el cliente, 2026-11-20 (V-05, V-06, V-07, V-08, V-09). Duración y `no_asistio`: PENDIENTE. **Supera** el modelo de cinco estados del Word v4.2.
- **Decision:** **cuatro estados**: `por_pagar`, `confirmada`, `completada`, `cancelada` (se elimina `pago_en_revision`). El comprobante queda ligado a su consulta, que sigue `por_pagar` hasta que el dentista confirme. `confirmada` y `completada` ocupan franja (completada como histórico de solo lectura); confirmar atómicamente, nunca rechazar pago en UI. Inicios cada **45 min**, desde el día siguiente (sin mismo día). Anticipo único global 10–20 Bs sobre consulta de 30 Bs; no se devuelve por cancelación del paciente ni inasistencia.
- **Reasoning:** respuestas del cliente; RF-17/18 y RNF-07.
- **Consequences:** varias `por_pagar` con comprobante pueden competir por la misma franja; el job de vencimiento debe distinguir las que tienen comprobante. **Pendiente:** duración 45 vs 90 min (V-05b); `no_asistio` (V-08b); anticipo de quien pierde la franja; vencimiento con comprobante entregado.

## ADR-006 — Stack, Node.js 24 y contratos
- **Status:** Propuesta tomada del brief.
- **Decision:** Node 24 LTS, pnpm/Turborepo, Next.js 15/React 19, NestJS 11, TypeORM 0.3, TS estricto, contracts/DTO compartidos, test unit/integration/E2E.
- **Reasoning:** reutilizar patrones probados por DevSure.
- **Consequences:** fijar versiones y verificar compatibilidad real en instalación. **Aprobar:** propietario.

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
- **Status:** Propuesta alineada con v4.2; detalle odontológico pendiente.
- **Decision:** versiones append-only de anamnesis/odontograma/índice/diagnóstico; dentista único autor; lectura de versiones anteriores.
- **Reasoning:** RF-24/25 y RD-01.
- **Consequences:** requiere reglas de comparación de versiones, nomenclatura y catálogo de piezas/estados aprobados. **Aprobar:** dentista.

## ADR-010 — Retención, correo y backups
- **Status:** ACEPTADA (valores RNF) por el cliente, 2026-11-20 (V-12). Plazo concreto de retención clínica: pendiente de asesoría local.
- **Decision:** preparar outbox de cancelación e infraestructura de backups restaurables; definir retención con validación de cliente y asesor local.
- **Reasoning:** disponibilidad y trazabilidad de datos de salud.
- **Consequences:** costos/operación según proveedor de email, almacenamiento y VPS.

## Registro de cambios

| Fecha | Estado | Autor | Resumen |
|---|---|---|---|
| 2026-11-20 | Propuestas iniciales | ChatGPT, revisión de fuentes | Documento base sin aprobación ni modificación del repositorio |
| 2026-11-20 | ADR-008 parcialmente aceptada | Propietario (registrado por Claude Code) | GitHub sigue público; `.docx` de requisitos fuera del repositorio; canónico/Forgejo pendiente |
| 2026-11-20 | ADR-001/003/004/010 aceptadas; ADR-005 parcialmente; ADR-008: Forgejo principal aceptado | Cliente (respuestas V-01…V-13, registradas por Claude Code) | Ver `docs/VALIDACION-REQUISITOS.md` §6 |
| 2026-11-20 | ADR-008 visibilidad ratificada | Propietario (instrucción directa en sesión de Claude Code) | GitHub sigue **público** por el momento pese a V-13 («espejo privado»); el cliente está informado |
