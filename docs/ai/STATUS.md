# STATUS — Estado vigente

**Fecha de captura:** 2026-11-25 11:47 (America/La_Paz, -04:00).
**Procedencia:** inspección del repositorio local `C:\dev\sistema-dental` y de GitHub por Claude Code (`git status`, `git log`, `git ls-remote`, `gh run watch`, `gh api .../branches/main/protection`) y ejecución local de validaciones. Forgejo: NO VERIFICADO (no configurado como remoto).
**as_of_sha (HEAD local = origin/main observado):** `12a81b093dce2941db5d6b25a4ca3fac32f23fc8`.

## Estado

- `FOUNDATIONS`: B-01 (CI) y B-02 (PostgreSQL + migraciones) en `12a81b0`. La CI de ese commit pasó en GitHub (run `45647278367`: validación e integración en verde).
- `main` **protegida** en GitHub (2026-11-25): PR obligatorio con 1 aprobación, checks `lint · typecheck · test · build` e `integración (PostgreSQL)` obligatorios y al día, historia lineal, sin force-push ni borrado, conversaciones resueltas. `enforce_admins` desactivado: el propietario puede saltarse las reglas.
- B-03 (TASK-004, seguridad HTTP base) **VERIFIED localmente**; en el commit siguiente a `12a81b0` (push directo a `main` autorizado). ADR-011 ACEPTADA.
- Colaboradora (alumna): pendiente; GitHub requiere su nombre de usuario.
- Remoto único `origin` → GitHub `acallecoymbra-cpu/SistemaDental`, **público** por el momento (ADR-008).

## B-03 entregado

- `apps/api/src/bootstrap.ts`: `trust proxy` configurable, `x-powered-by` desactivado, `x-request-id`, helmet, CORS solo para `WEB_ORIGINS` con credenciales, `cookie-parser`, verificación de origen (CSRF) en POST/PUT/PATCH/DELETE, `ValidationPipe` en lista blanca estricta, filtro global de errores.
- `apps/api/src/common/`: `security-options.ts`, `request-id.ts`, `origin-check.ts`, `all-exceptions.filter.ts` y pruebas.
- `packages/contracts/src/errors.ts`: `ApiErrorResponse`.
- Variables nuevas obligatorias: `WEB_ORIGINS`; opcional `TRUST_PROXY`. **`.env.example` no se actualizó**: los archivos `.env*` están bloqueados por los permisos de la sesión; debe agregarlas el propietario.
- ADR-011 ACEPTADA por el propietario: estrategia CSRF por origen y forma única de errores.

## Validaciones ejecutadas (2026-11-25, Windows 11, Node 24.22.3, pnpm 12.18.0, Docker 29.6.1)

| Comando | Resultado |
|---|---|
| `prettier --check .` | PASS |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | PASS |
| `pnpm test` | PASS: api 18 (incluye 13 de seguridad HTTP), contracts 4, web 3 |
| `pnpm test:integration` | PASS: 5 |
| CI en GitHub para `12a81b0` | PASS (ambos trabajos) |

No ejecutado: arranque manual de la API con el `.env` local (le falta `WEB_ORIGINS` hasta que el propietario lo agregue); E2E Playwright (B-06).

## Bloqueadores

1. Lista de estados de pieza del consultorio (V-25): bloquea T-16 / TASK-504.
2. Usuario de GitHub de la alumna: bloquea darle acceso.

## Próxima acción recomendada

Propietario agrega `WEB_ORIGINS=http://localhost:3000` y `TRUST_PROXY=false` a `.env.example` y `.env`; STAGE/COMMIT/PUSH de B-03 con autorización; luego B-04 (login del dentista, sesiones y auditoría mínima).

## Autorizaciones

| Acción | Estado |
|---|---|
| STAGE | Autorizado: el propietario autorizó el push directo a `main` (2026-11-25), que incluye stage y commit |
| COMMIT | Autorizado (mismo permiso, 2026-11-25) |
| PUSH | Autorizado por el propietario, directo a `main` sin PR (2026-11-25) |
| DEPLOY | No autorizado |
| Agregar colaboradora | Pendiente: falta su usuario de GitHub |
