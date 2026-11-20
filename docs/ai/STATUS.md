# STATUS — Estado vigente

**Fecha de captura:** 2026-11-20 17:34 (America/La_Paz, -04:00).
**Procedencia:** inspección del repositorio local `C:\dev\sistema-dental` por Claude Code (`git status --short`, `git rev-parse HEAD`, `git branch -vv`, `git remote -v`, `git ls-remote origin main`). Forgejo: NO VERIFICADO (no configurado como remoto).
**as_of_sha (HEAD local = origin/main observado):** `d49f6e037fa93a2f5df6b2001710fb1f866c33dd`.

## Estado

- `PLANNING / VALIDACIÓN PARCIAL`: el cliente respondió las preguntas de validación el 2026-11-20; respuestas registradas en `docs/VALIDACION-REQUISITOS.md` §6.
- Remoto único `origin` → GitHub `acallecoymbra-cpu/SistemaDental`, rama `main`, visibilidad **PUBLIC** (observada el 2026-11-20). No hay remoto Forgejo.
- Paquete de planificación versionado en `d49f6e0` (en `origin/main`).
- Cambios de esta entrega, incluidos en el commit siguiente a `d49f6e0` (STAGE, COMMIT y PUSH autorizados el 2026-11-20): `docs/VALIDACION-REQUISITOS.md`, `docs/DATA-MODEL.md`, `docs/PLAN.md`, `docs/ai/{DECISIONS,MASTER,PROTOCOL,ROADMAP,STATUS,HANDOFF}.md`.
- ADR aceptadas por el cliente: ADR-001 (PostgreSQL), ADR-003 (nombre + celular sin código), ADR-004 (web, una clínica), ADR-010 (RNF). ADR-005 parcialmente (cuatro estados, inicios 45 min, anticipo único). ADR-008: GitHub sigue **público**, ratificado por el propietario pese a V-13; Forgejo principal aceptado, sin configurar.
- No existe monorepo ejecutable (`apps`, `packages`), backend ni persistencia del sistema real.
- Tests: **NOT EXECUTED** (no hay código).

## Bloqueadores

1. Duración de consulta 45 vs 90 min (V-05b): bloquea TASK-203 y la restricción de solapes.
2. Resto de preguntas abiertas en `docs/VALIDACION-REQUISITOS.md` §7 (anticipo de quien pierde la franja, vencimiento con comprobante, celular del menor, `no_asistio`, estados del odontograma).

## Próxima acción recomendada

Revisión del propietario de los cambios documentales; luego STAGE/COMMIT/PUSH con autorización separada para cada operación. Enviar al cliente las preguntas de §7. No iniciar TASK-002 sin cerrar la duración de consulta.

## Autorizaciones

| Acción | Estado |
|---|---|
| STAGE | Autorizado por el propietario (2026-11-20) |
| COMMIT | Autorizado por el propietario (2026-11-20) |
| PUSH | Autorizado por el propietario (2026-11-20) |
| DEPLOY | No autorizado |
