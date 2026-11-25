# STATUS — Estado vigente

**Fecha de captura:** 2026-11-25 12:11 (America/La_Paz, -04:00).
**Procedencia:** inspección del repositorio local `C:\dev\sistema-dental` y de GitHub por Claude Code (`git status`, `git log`, `git ls-remote`, `gh run watch`) y ejecución local de validaciones. Forgejo: NO VERIFICADO (no configurado como remoto).
**as_of_sha (HEAD local = origin/main observado):** `754d34481498f20ad168e89e02a1c123bda9bf6d`.

## Estado

- `FOUNDATIONS`: B-01, B-02 (`12a81b0`) y B-03 (`754d344`) en `main`; CI de `754d344` en verde (run `45649314711`). ADR-011 aceptada.
- `main` protegida en GitHub (PR + 1 aprobación + 2 checks; el propietario puede saltarse las reglas).
- B-04 (TASK-101 login/sesiones + TASK-102 auditoría mínima) **VERIFIED localmente**, en el commit siguiente a `754d344` (push autorizado). ADR-012 ACEPTADA.
- Colaboradora (alumna): pendiente; falta su usuario de GitHub.
- Remoto único `origin` → GitHub `acallecoymbra-cpu/SistemaDental`, **público** por el momento (ADR-008).

## B-04 entregado

- Migración `AuthAndAudit1764200000000`: `dentist_user` (un solo activo por índice parcial), `auth_session`, `audit_log` con triggers que prohíben UPDATE/DELETE/TRUNCATE.
- `apps/api/src/auth`: Argon2id (`@node-rs/argon2` 2.2.2), token opaco con hash SHA-256 en BD, cookie `sd_session` (`httpOnly`, `SameSite=Lax`, `Path=/api`, `Secure` en producción), guard global con `@Public()`, contraseña temporal obligatoria, bloqueo 5 fallos/15 min (429), inactividad 30 min, máximo 12 h.
- Endpoints: `POST /api/v1/auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`. `/health` marcado `@Public()`.
- `apps/api/src/audit`: `AuditService` (IP como HMAC con `AUDIT_IP_SALT`), eventos de acceso.
- CLI `pnpm --filter @sistema-dental/api dentist:create --username … --name "…"`.
- `packages/contracts/src/auth.ts`: constantes y tipos de acceso.
- Variables nuevas opcionales: `COOKIE_SECURE`, `AUDIT_IP_SALT` (obligatoria en producción). Pendiente de B-03: `WEB_ORIGINS` y `TRUST_PROXY` en `.env.example` (archivos `.env*` bloqueados para Claude Code).

## Validaciones ejecutadas (2026-11-25, Windows 11, Node 24.22.3, pnpm 12.18.0, Docker 29.6.1)

| Comando | Resultado |
|---|---|
| `prettier --check .` | PASS |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | PASS |
| `pnpm test` | PASS: api 28, contracts 4, web 3 |
| `pnpm test:integration` | PASS: 22 (17 de autenticación/auditoría, 3 de migraciones, 2 de health) |
| CLI `dentist:create` contra `sistema_dental_test` | Crea con clave temporal y `must_change_password`; se niega con dentista activo o usuario repetido |

No ejecutado: login manual contra la API con el `.env` local (requiere `WEB_ORIGINS`); E2E Playwright (B-06).

## Bloqueadores

1. Lista de estados de pieza del consultorio (V-25): bloquea T-16 / TASK-504.
2. Usuario de GitHub de la alumna.

## Próxima acción recomendada

B-05: el propietario decidió (2026-11-25) que nosotros hagamos el catálogo de tratamientos de punta a punta como molde para la alumna.

## Autorizaciones

| Acción | Estado |
|---|---|
| STAGE | Autorizado por el propietario (2026-11-25); hecho |
| COMMIT | Autorizado: el propietario autorizó el push de B-04 (2026-11-25), que incluye el commit |
| PUSH | Autorizado por el propietario, directo a `main` (2026-11-25) |
| DEPLOY | No autorizado |
| Agregar colaboradora | Pendiente: falta su usuario de GitHub |
