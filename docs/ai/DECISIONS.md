# DECISIONS — ADR iniciales / propuestas

**Regla:** `Propuesta` no significa `Aceptada`. Las decisiones del dueño o cliente se registran aquí o en un ADR dedicado, con fecha y evidencia. Cambios a ADR aceptado requieren nuevo ADR.

## ADR-001 — Persistencia PostgreSQL
- **Status:** Propuesta; **Date:** 2026-11-20.
- **Context:** cita de 90 min, confirmación de pago concurrente y RNF-07 de no solapes.
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
- **Status:** Pendiente crítico; **Date:** 2026-11-20.
- **Context:** CU-03 permite ver citas usando nombre y celular, con rate limit, pero no verifica posesión.
- **Decision:** NO cerrada. Evaluar OTP de un solo uso/enlace seguro si cliente aprueba mecanismo adicional; conservar semántica «sin cuenta».
- **Reasoning:** reducir suplantación y exposición de datos de citas.
- **Consequences:** puede añadir servicio/costo externo y modificar RF-08/09. **Aprobar:** cliente y propietario.

## ADR-004 — Una clínica, un dentista y web como único cliente MVP
- **Status:** Propuesta alineada con v4.2, a ratificar.
- **Context:** v4.2 excluye segundo profesional, recepcionista y cuentas.
- **Decision:** web responsiva Next.js + API NestJS; no crear app Expo en MVP. Permisos del único dentista y rutas públicas para pacientes.
- **Reasoning:** respetar alcance, evitar arquitectura sobredimensionada.
- **Consequences:** paso de selección de especialidad de la demo se elimina/adapta. **Aprobar:** cliente.

## ADR-005 — Estado y reserva de consulta
- **Status:** Propuesta alineada con v4.2; cuestiones terminales pendientes.
- **Decision:** cinco estados; solo `confirmada` bloquea franja; comprobante único; confirmar atómicamente, nunca rechazar pago en UI. Duración 90 min, comienzo cada 30 min sujeto a S-03.
- **Reasoning:** refleja RN-03/RN-06/RN-07, RF-17/18 y RD-02.
- **Consequences:** múltiples pagos en revisión sobre franja; gestión manual de devolución. **Pendiente:** citas completadas/ausencias y pagos en revisión vencidos.

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
- **Status:** PARCIALMENTE ACEPTADA (2026-11-20). Visibilidad: ACEPTADA. Repositorio canónico / Forgejo: PENDIENTE.
- **Context:** brief indica Forgejo canónico + GitHub mirror privado, pero GitHub observado es público, rama main, con commit inicial. Forgejo no configurado como remoto.
- **Decision (aceptada por el propietario, 2026-11-20, instrucción directa en sesión de Claude Code):** el repositorio GitHub `acallecoymbra-cpu/SistemaDental` **permanece público**. El documento de requisitos `Doc_Dentista_v4.2.docx` **no se versiona** en el repositorio. Esto se desvía del brief §10.4 («mirror privado»).
- **Pendiente:** si Forgejo será canónico y GitHub mirror; mientras tanto no cambiar remotos sin orden expresa.
- **Reasoning:** decisión del propietario; la documentación de planificación no contiene datos de pacientes.
- **Consequences:** todo lo versionado es público. Prohibido en Git: datos reales de pacientes, archivos clínicos, secretos, credenciales y el documento de requisitos del cliente. Revisar cada STAGE con este criterio. **Aprobar (pendiente):** propietario.

## ADR-009 — Historial clínico
- **Status:** Propuesta alineada con v4.2; detalle odontológico pendiente.
- **Decision:** versiones append-only de anamnesis/odontograma/índice/diagnóstico; dentista único autor; lectura de versiones anteriores.
- **Reasoning:** RF-24/25 y RD-01.
- **Consequences:** requiere reglas de comparación de versiones, nomenclatura y catálogo de piezas/estados aprobados. **Aprobar:** dentista.

## ADR-010 — Retención, correo y backups
- **Status:** PENDIENTE (RNF con valores propuestos).
- **Decision:** preparar outbox de cancelación e infraestructura de backups restaurables; definir retención con validación de cliente y asesor local.
- **Reasoning:** disponibilidad y trazabilidad de datos de salud.
- **Consequences:** costos/operación según proveedor de email, almacenamiento y VPS.

## Registro de cambios

| Fecha | Estado | Autor | Resumen |
|---|---|---|---|
| 2026-11-20 | Propuestas iniciales | ChatGPT, revisión de fuentes | Documento base sin aprobación ni modificación del repositorio |
| 2026-11-20 | ADR-008 parcialmente aceptada | Propietario (registrado por Claude Code) | GitHub sigue público; `.docx` de requisitos fuera del repositorio; canónico/Forgejo pendiente |
