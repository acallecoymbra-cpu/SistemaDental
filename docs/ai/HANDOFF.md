# HANDOFF — continuidad

**as_of_sha:** `725f0064e526101662eca2c35e732a0603ccbb8a` · **Fecha:** 2026-11-23 15:40 (America/La_Paz) · **Procedencia:** Claude Code, repositorio local verificado.

## Resumen de continuidad (≤25 líneas)

- Proyecto: Renovando Sonrisas / Sistema Dental.
- Estado: validación parcial de requerimientos y planificación, no desarrollo.
- Fuente: Word v4.2 (18/11/2026), modificado por las respuestas del cliente (`docs/VALIDACION-REQUISITOS.md` §6, §6.2 y §6.3); el Word no está versionado.
- Repositorio: único remoto GitHub `acallecoymbra-cpu/SistemaDental` (público por el momento), `main` = `725f006`; Forgejo no configurado.
- Cambios de la segunda y tercera ronda: en el commit siguiente a `725f006` (STAGE, COMMIT y PUSH autorizados el 2026-11-23).
- Alcance: `docs/PLAN.md`. Modelo DB: `docs/DATA-MODEL.md`. Decisiones: `docs/ai/DECISIONS.md`. Roadmap: `docs/ai/ROADMAP.md` (TASK-001 IN_PROGRESS).
- Validaciones: NO EJECUTADAS; nada implementado.
- STAGE, COMMIT y PUSH autorizados para esta entrega; DEPLOY sin autorización.

## Última entrega — segunda ronda de respuestas del cliente (registrada 2026-11-23)

Fuente: conversación de WhatsApp con el cliente del 2026-11-20, pegada por el propietario. Solo documentación:

- `docs/VALIDACION-REQUISITOS.md`: §6.2 con V-14…V-19; riesgos 2, 3, 5, 6 y 7 actualizados; §7 con 6 puntos abiertos.
- `docs/DATA-MODEL.md`: `patient.is_minor` + `CHECK` de `guardian_phone`; consulta de menores con celular del apoderado; caducidad solo sin comprobante; anticipo sin devolución.
- `docs/ai/DECISIONS.md`: ADR-003 (menores), ADR-005 (sin devolución, no vence con comprobante, conflicto V-16), ADR-009 (FDI y CPO-D aceptados).
- `docs/ai/ROADMAP.md`: TASK-001, TASK-302, TASK-303, TASK-304 y TASK-504 ajustadas.

## Entrega posterior — tercera ronda (registrada 2026-11-23)

- `docs/VALIDACION-REQUISITOS.md`: §6.3 con V-20…V-25; riesgos 2, 4 y 6 resueltos; §7 reducido a 4 puntos.
- `docs/DATA-MODEL.md`: franja fija de 45 min; `appointment.hold_expires_at` (8 min); 5 estados con `no_asistio`; restricción de exclusión incluye `por_pagar`, `confirmada`, `completada`, `no_asistio`; reserva cancela vencidas en la misma transacción.
- `docs/ai/DECISIONS.md`: ADR-005 aceptada. `docs/PLAN.md` §4.1, `MASTER.md`, `PROTOCOL.md`, `ROADMAP.md` (TASK-203 desbloqueada; 302, 304, 401, 404) alineados.

## Punto exacto de reanudación

1. Re-verificar Git (no asumir que sigue en `725f006`).
2. Con autorización separada: STAGE, COMMIT, PUSH de los archivos listados en `STATUS.md`.
3. Confirmar con el cliente los puntos 2 y 3 de `VALIDACION-REQUISITOS.md` §7 y esperar la lista de estados de pieza.
4. Con autorización del propietario, iniciar TASK-002 (monorepo).
