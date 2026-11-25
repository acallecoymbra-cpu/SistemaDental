# HANDOFF — continuidad

**as_of_sha:** `93d7a3d691ee2e974d85b71a773e299d4a15f599` · **Fecha:** 2026-11-25 11:18 (America/La_Paz) · **Procedencia:** Claude Code, repositorio local verificado y validaciones ejecutadas localmente.

## Resumen de continuidad (≤25 líneas)

- Proyecto: Renovando Sonrisas / Sistema Dental.
- Estado: monorepo en `93d7a3d`; base B-01 (CI) y B-02 (PostgreSQL + migraciones) verificadas localmente; en el commit siguiente a `93d7a3d`.
- Reparto aprobado (2026-11-25): base B-01…B-06 por propietario/Claude Code; tareas T-01…T-18 por la alumna (`docs/PLAN-IMPLEMENTACION.md`).
- Requisitos: Word v4.2 modificado por las respuestas del cliente (`docs/VALIDACION-REQUISITOS.md` §6–§6.3).
- Repositorio: GitHub `acallecoymbra-cpu/SistemaDental` (público por el momento); Forgejo no configurado.
- Validaciones: ver tabla en `STATUS.md`.
- STAGE, COMMIT, PUSH y protección de `main` autorizados (2026-11-25); DEPLOY sin autorización.

## Última entrega — B-01 y B-02 (2026-11-25)

- B-01: `.github/workflows/ci.yml` con dos trabajos: validación (prettier, lint, typecheck, test, build) e integración (servicio `postgres:17-bookworm`). Acciones fijadas por SHA: checkout v7.0.1, setup-node v7.1.0, pnpm/action-setup v6.1.1.
- B-02: `docker-compose.yml`, `infra/postgres/init/01-test-database.sql`, `.env.example` (`.env` local ignorado por Git), `apps/api/src/config/env.validation.ts` (Joi), `apps/api/src/database/{data-source-options,data-source,database.module}.ts`, migración `1764100000000-InitialExtensions` (`btree_gist`), `HealthResponse.database`.
- Pruebas: unitarias sin BD (`jest.config.js`) e integración (`jest.integration.config.js`, `test/integration/`). La base de pruebas debe terminar en `_test` o las pruebas se niegan a correr.
- Scripts raíz: `db:up`, `db:down`, `db:migrate`, `test:integration`. Scripts api: `migration:run|revert|show|create`.
- Docs: `README.md`, `ROADMAP.md` (TASK-003 VERIFIED), ADR-001 (implementación), `PLAN-IMPLEMENTACION.md` (B-01/B-02 hechas, reparto aprobado), `DECISIONS.md` (registro del reparto).

## Notas de entorno

- Node 20 es el global (nvm-windows); las validaciones usan Node 24.22.3 anteponiendo su carpeta al `PATH`. A mano: `nvm use 24`.
- Docker Desktop fue iniciado por Claude Code; el contenedor `sistema-dental-postgres` queda corriendo (`pnpm db:down` lo detiene).

## Punto exacto de reanudación

1. Re-verificar Git (no asumir que sigue en `93d7a3d`).
2. Con autorización separada: STAGE, COMMIT, PUSH; comprobar que la CI pasa en GitHub.
3. Proteger `main` y dar acceso a la alumna (requiere autorización del propietario).
4. B-03: seguridad base (DTOs validados, errores genéricos, CORS, cookies seguras, CSRF).
