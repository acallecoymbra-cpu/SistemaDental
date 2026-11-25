# STATUS — Estado vigente

**Fecha de captura:** 2026-11-25 11:18 (America/La_Paz, -04:00).
**Procedencia:** inspección del repositorio local `C:\dev\sistema-dental` por Claude Code (`git status`, `git fetch`, `git log`) y ejecución local de validaciones. Forgejo: NO VERIFICADO (no configurado como remoto).
**as_of_sha (HEAD local = origin/main observado):** `93d7a3d691ee2e974d85b71a773e299d4a15f599`.

## Estado

- `FOUNDATIONS`: TASK-002 en `93d7a3d`. Base B-01 (CI) y B-02 (TASK-003, PostgreSQL + migraciones) **VERIFIED localmente**; en el commit siguiente a `93d7a3d` (STAGE, COMMIT y PUSH autorizados el 2026-11-25).
- Reparto aprobado por el propietario el 2026-11-25: base por propietario/Claude Code, funcionalidades por la alumna (`docs/PLAN-IMPLEMENTACION.md`, en el mismo commit).
- Remoto único `origin` → GitHub `acallecoymbra-cpu/SistemaDental`, rama `main`, **pública** por el momento (ADR-008). `main` aún sin protección.
- Nuevo en B-01/B-02: `.github/workflows/ci.yml` (validación + integración con servicio PostgreSQL, acciones fijadas por SHA), `docker-compose.yml` (PostgreSQL 17), `infra/postgres/init/` (crea `sistema_dental_test`), `.env.example`, `apps/api/src/config` (validación Joi), `apps/api/src/database` (DataSource, módulo, primera migración `btree_gist`), pruebas de integración, health con estado de BD.
- Sin autenticación ni funcionalidad de negocio (B-03 en adelante).

## Validaciones ejecutadas (2026-11-25, Windows 11, Node 24.22.3, pnpm 12.18.0, Docker 29.6.1)

| Comando | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `prettier --check .` | PASS |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | PASS |
| `pnpm test` | PASS: contracts 4, api 2 (sin BD), web 3 |
| `pnpm test:integration` | PASS: 5 (migraciones aplicar/revertir/reaplicar, `synchronize=false`, health con BD real) |
| `pnpm test:integration` sin `.env` y con `DATABASE_URL_TEST` en el entorno (simula CI) | PASS: 5 |
| `pnpm db:migrate` sobre `sistema_dental` | `InitialExtensions1764100000000` aplicada |
| API sin `DATABASE_URL` | No arranca: `"DATABASE_URL" is required` |
| `GET /api/v1/health` con BD de desarrollo | 200 `{"status":"ok","database":"up"}` |

No ejecutado: el workflow en GitHub Actions (se verá al primer push), E2E Playwright (B-06).

## Bloqueadores

1. Lista de estados de pieza del consultorio (V-25): bloquea T-16 / TASK-504.

## Próxima acción recomendada

STAGE/COMMIT/PUSH con autorización; proteger `main` y dar acceso a la alumna en GitHub; luego B-03 (seguridad base).

## Autorizaciones

| Acción | Estado |
|---|---|
| STAGE | Autorizado por el propietario (2026-11-25) |
| COMMIT | Autorizado por el propietario (2026-11-25) |
| PUSH | Autorizado por el propietario (2026-11-25) |
| DEPLOY | No autorizado |
| Protección de `main` en GitHub | Autorizada por el propietario (2026-11-25) |
| Agregar colaboradora | Pendiente: falta su usuario de GitHub |
