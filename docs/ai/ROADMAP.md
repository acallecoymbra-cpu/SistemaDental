# ROADMAP — Renovando Sonrisas

**Estado:** PLANIFICADO; sin implementación. Fuente: requerimientos v4.2 (RF-01..28, RNF-01..14). La prioridad del documento es Alta/Media; las fases siguientes son **orden de desarrollo**, no cambio de prioridad. Cada TASK es un vertical slice con contrato, migración, API, UI y test cuando aplique.

| Epic | Fase | Objetivo | Requisitos |
|---|---|---|---|
| E0 | 0 | Fundaciones, seguridad, memoria | RNF-05/06/07/11/14 |
| E1 | 1 | Dentista: autenticación y administración | RF-13, RF-27 |
| E2 | 2 | Catálogo/horarios y disponibilidades | RF-01/02/14/15 |
| E3 | 3 | Paciente y reserva pública | RF-03/04/05/06/08/09 |
| E4 | 4 | Anticipo QR, confirmación, gestión agenda | RF-07/16/17/18/19/20/21/27 |
| E5 | 5 | Ficha e historia clínica | RF-22/23/24/25/26/27 |
| E6 | 6 | Chat reglas, WhatsApp, hardening | RF-10/11/12/28, RNF-01..14 |

## Fase 0 — Fundaciones

- **TASK-001 · Validación de requisitos/ADR:** aprobar S-01…S-14 críticos, reglas de privacidad, motor y PK. **AC:** decisiones registradas con fuente y responsable; ninguna laguna crítica etiquetada como resuelta sin evidencia. **Estado:** IN_PROGRESS — respuestas del cliente registradas el 2026-11-20 (`VALIDACION-REQUISITOS.md` §6); tres rondas registradas (§6–§6.3); solo queda bloqueante la lista de estados de pieza (§7).
- **TASK-002 · Monorepo Node 24:** inicializar pnpm/Turborepo, `apps/web`, `apps/api`, `packages/contracts`, linters y scripts. **AC:** `pnpm lint`, `typecheck`, `test`, `build` ejecutados y reportados; health responde.
- **TASK-003 · Datos y migraciones:** motor aprobado, TypeORM migraciones, transacciones, backup local sin secretos. **AC:** DB arranca de cero, `synchronize=false`, rollback documentado, tests con fixtures sintéticas.
- **TASK-004 · Seguridad base:** HTTPS/proxy config, sesiones, CSRF, DTOs, excepciones seguras, controles de privacidad. **AC:** pruebas negativas de rutas protegidas, secretos ausentes de repo/logs.
- **TASK-005 · Memoria de proyecto:** `AGENTS.md` + protocolo + snapshot `STATUS/HANDOFF`. **AC:** bootstrap reproducible de sesión sin depender del chat. **Estado:** IMPLEMENTED (borradores entregados con el paquete de planificación, 2026-11-20); pendiente de aprobación y de versionar (STAGE/COMMIT).

## Fase 1 — Dentista

- **TASK-101 · Login/Logout:** `dentist_user` + sesiones opacas, Argon2. **AC:** credenciales válidas inician sesión; 5 fallos bloquean 15 min; inactividad 30 min cierra; no registro público.
- **TASK-102 · Auditoría mínima:** writes, intentos de cambios y **lecturas de datos clínicos** (brief §5). **AC:** cada confirmación/cancelación/edición guarda actor y fecha; cada apertura de ficha/historia clínica registra actor, entidad y fecha sin copiar contenido clínico; solo INSERT en log.

## Fase 2 — Catálogo + horarios

- **TASK-201 · Tratamientos y configuración:** siete seeds aprobadas, lista pública activa, CRUD privado y `clinic_settings` (consulta 30 Bs, anticipo único, QR). **AC:** anticipo en rango 10–20 Bs; nombres únicos; desactivar no altera consultas; anticipo snapshot en la cita; cambios de anticipo/QR auditados.
- **TASK-202 · Intervalos de atención:** crear/editar/eliminar por día. **AC:** mínimo la duración vigente de consulta, no superponer intervalos, no reducir horario excluyendo confirmadas.
- **TASK-203 · Disponibilidad real:** endpoint por fecha calcula franjas de 45 min y oculta las ocupadas por `por_pagar` vigente, `confirmada`, `completada` o `no_asistio`. **AC:** casos borde en fin de intervalo, reserva vencida liberada, rechazo del mismo día (mínimo el día siguiente) y huso Bolivia; tests de API.

## Fase 3 — Paciente + reservas

- **TASK-301 · Portal público adaptado:** Lúmina adaptada a Renovando Sonrisas sin preferencias de múltiples dentistas. **AC:** catálogo real y UI responsive 360 px; todos los datos falsos retirados.
- **TASK-302 · Creación de cita:** paso «¿ya estás registrado?», DTO/API paciente con nombre/celular/email, fecha de nacimiento y celular de padre/madre si es menor; deduplicación. **AC:** crea `por_pagar` que aparta la franja 8 min; dos reservas simultáneas de la misma franja: solo una gana (test concurrente contra BD real); límite 3 pendientes; rechaza fecha/hora inválida o del mismo día; menor (etiqueta) sin celular de apoderado rechazado; tests concurrentes de límite.
- **TASK-303 · Mis consultas:** lookup por nombre + celular sin código (ADR-003); menores con el celular del apoderado (V-18); visualización mínima. **AC:** 5 fallos/10 min ⇒ 15 min, errores genéricos, ausencia de datos de otros y de historia.
- **TASK-304 · Caducidad `por_pagar`:** job idempotente cada minuto. **AC:** cancela `por_pagar` sin comprobante pasados 8 min y libera la franja; las que tienen comprobante no se cancelan (V-17).

## Fase 4 — Anticipo y agenda

- **TASK-401 · QR/comprobante:** QR vigente de `clinic_settings` y número de comprobante único ligado a su consulta. **AC:** pago externo no automatizado; la consulta sigue `por_pagar`; comprobante rechazado si llega después de los 8 min o si está duplicado.
- **TASK-402 · Confirmación transaccional:** dentista ve consultas `por_pagar` con comprobante y confirma. **AC:** solo una confirmada por franja, incluso 2 requests paralelos; no existe acción de rechazar; queda autor y hora.
- **TASK-403 · Agenda administrativa:** vista día/semana, filtros y detalle. **AC:** estados y paciente filtrables, detalle con anticipo/comprobante, consultas ordenadas.
- **TASK-404 · Reprogramar:** mueve `por_pagar`/`confirmada` con auditoría. Incluye marcar `no_asistio` desde `confirmada` con inicio ocurrido. **AC:** transacción sin choque, before/after; estados terminales bloqueados.
- **TASK-405 · Cancelar + outbox correo:** el dentista cancela (a pedido del paciente por WhatsApp o propio) y registra motivo; anticipo no devuelto; worker email; sin correo ⇒ aviso al dentista (PROPUESTA). **AC:** cancelación lógica, cita libre, auditoría y hasta 3 intentos; correo único tipo cancelación, sin afectar transacción si falla SMTP.

## Fase 5 — Clínica

- **TASK-501 · Gestión pacientes:** alta/edición, buscar por nombre/celular. **AC:** misma pareja normalizada no se duplica; celular compartido advierte; resultados con índice.
- **TASK-502 · Ficha paciente:** consultas, últimos/anteriores historiales. **AC:** acceso exclusivo dentista, sin exposición pública.
- **TASK-503 · Historial inmutable:** crear version n+1, solo con cambios. **AC:** versiones anteriores inmutables; auditoría; carrera de versiones controlada.
- **TASK-504 · Odontograma/índice:** validar FDI/CPO-D y estados aprobados. FDI y CPO-D aceptados (V-19). **BLOCKED** hasta que el consultorio entregue su lista de estados de pieza. **AC:** piezas/estados inválidos rechazados; mismo snapshot de la versión; sin implementación hasta validar terminología.
- **TASK-505 · Completar consulta:** diagnóstico y costo Bs. **AC:** solo confirmada con inicio ocurrido, costo ≥0, terminal inmutable; ofrecer nueva versión sin exigirla.

## Fase 6 — Chat y calidad integral

- **TASK-601 · Chat reglas:** preguntas de clínica, conceptos, emergencia y fallback. **AC:** no IA, no diagnóstico, no captura de datos personales, WhatsApp visible y no integrado.
- **TASK-602 · RNF rendimiento/responsividad:** medir p95, búsqueda, capacidad y UX contra metas aprobadas. **AC:** informe con método, fecha, métricas y resultado PASS/FAIL/NOT EXECUTED.
- **TASK-603 · Seguridad/privacidad:** autorización clínica, IDOR, rate limit, HTTPS y logging seguro. **AC:** pruebas de abuso y threat model con hallazgos cerrados.
- **TASK-604 · Backups/recovery:** automatizar backup y restaurar en entorno aislado. **AC:** evidencia de ejecución/retiro y RTO medido vs RNF aprobado.
- **TASK-605 · Cross-browser + E2E integral:** paciente reserva/paga, dentista confirma/mueve/cancela, historia clínica. **AC:** matriz Chrome/Edge/Firefox/Safari según valores aprobados; casos E2E reproducibles.
- **TASK-606 · Deploy VPS:** solo después de QA y autorización separada. **AC:** migración, verificación HTTPS/health/backup y plan de rollback; reporte as_of_sha y URL productiva verificada.

## Reglas de cierre

- Cada tarea se mueve por `PLANNED → IN_PROGRESS → IMPLEMENTED → VERIFIED → COMMITTED → PUSHED → DEPLOYED`, con evidencia independiente; `BLOCKED` si faltan insumos.
- DoD: tests por capas, lint/typecheck/build, seguridad específica, documentación de cambios y no regresiones; no declarar PASS sin ejecutar.
- `STAGE`, `COMMIT`, `PUSH`, `DEPLOY` independientes: pedir cada permiso explícitamente.
- Todo task cerrado actualiza `STATUS.md` y `HANDOFF.md` cuando se versiona; ADR y `MODULE.md` solo si corresponde.
