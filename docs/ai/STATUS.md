# STATUS — Estado vigente

**Fecha de captura:** 2026-11-25 13:58 (America/La_Paz, -04:00).
**Procedencia:** inspección del repositorio local `C:\dev\sistema-dental` y de GitHub por Claude Code (`git status`, `git log`, `git ls-remote`, `gh run watch`) y ejecución local de validaciones. Forgejo: NO VERIFICADO (no configurado como remoto).
**as_of_sha (HEAD local = origin/main observado):** `53d5812a99c4eb09d4da2b9437a04f10c2021fab`.

## Estado

- `FOUNDATIONS`: B-01…B-04 en `main` (`53d5812`); CI de `53d5812` en verde (run `45653761946`). ADR-011 y ADR-012 aceptadas.
- `main` protegida en GitHub (PR + 1 aprobación + 2 checks; el propietario puede saltarse las reglas).
- B-05 (molde de tratamientos de punta a punta, decidido por el propietario el 2026-11-25) y B-06 (Playwright) **VERIFIED localmente**; en el commit siguiente a `53d5812` (STAGE, COMMIT y PUSH directo a `main` autorizados el 2026-11-25). El propietario autorizó además agregar `e2e (Playwright)` como check obligatorio de `main` cuando pase en GitHub.
- Colaboradora (alumna): pendiente; falta su usuario de GitHub.
- Remoto único `origin` → GitHub `acallecoymbra-cpu/SistemaDental`, **público** por el momento (ADR-008).

## B-05 y B-06 entregados

- **API:** migración `CreateTreatments1764300000000` (tabla `treatment` + semilla de 7 tratamientos del Word), módulo `treatments` (público `GET /treatments`; panel `GET/POST/PATCH /admin/treatments`), auditoría en la misma transacción, `MODULE.md`.
- **Contratos:** `packages/contracts/src/treatments.ts`.
- **Web (base + molde):** rewrites `/api/*` → API (misma origen, cookie `Path=/api`), `apiFetch` y `ApiError`, `ErrorAlert`, `globals.css` con tokens y tabla responsive, login del dentista (`/panel/login`), panel protegido con `SessionProvider` (redirige a login y a cambio de contraseña), `/panel/cambiar-clave`, `/panel/tratamientos` (listar, crear, editar, activar/desactivar), portal `/` con tratamientos activos.
- **Pruebas:** utilidades de integración reutilizables (`test/integration/helpers.ts`), 10 pruebas de integración de tratamientos; Playwright 1.65.1 con 6 recorridos × 2 proyectos (escritorio y celular 360 px); base E2E propia `sistema_dental_e2e` preparada por `e2e/prepare-db.mts`.
- **CI:** nuevo trabajo `e2e (Playwright)` con servicio PostgreSQL; sube el reporte solo si falla. **No** se agregó todavía como check obligatorio de `main`.
- **Docs:** `docs/GUIA-MOLDE-MODULO.md` (para la alumna), `PLAN-IMPLEMENTACION.md`, `ROADMAP.md`, `DATA-MODEL.md`, `README.md`.
- **Corrección de entorno:** `AUDIT_IP_SALT` vacía hacía fallar el arranque en desarrollo (Joi no acepta texto vacío). Ahora, fuera de producción, vacía equivale a no definida; en producción sigue obligatoria (≥32). 5 pruebas nuevas de la validación de entorno.
- **`.env` local del propietario:** verificado de forma indirecta (Claude Code no puede leer `.env*`): la API arranca, conecta a la BD, acepta `Origin: http://localhost:3000` (401 en login con usuario inexistente) y rechaza otros orígenes (403); CORS devuelve `http://localhost:3000`. `.env.example` **no** cambió en Git: sigue sin `WEB_ORIGINS`/`TRUST_PROXY`.
- Base de desarrollo `sistema_dental` migrada hasta `CreateTreatments1764300000000` (sin dentista creado).

## Validaciones ejecutadas (2026-11-25, Windows 11, Node 24.22.3, pnpm 12.18.0, Docker 29.6.1, Chromium de Playwright 1.65.1)

| Comando | Resultado |
|---|---|
| `prettier --check .` | PASS |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | PASS |
| `pnpm test` | PASS: api 33, contracts 4, web 3 |
| `pnpm test:integration` | PASS: 32 (10 de tratamientos) |
| `pnpm test:e2e` | PASS: 12 (6 recorridos en escritorio y en 360 px) |
| API con el `.env` local | Arranca; health `database: up`; CSRF y CORS correctos para `http://localhost:3000` |

No ejecutado: el trabajo `e2e` en GitHub Actions (se verá con este push); login manual en el navegador (no hay dentista en la base de desarrollo; crear con `dentist:create`).

## Bloqueadores

1. Lista de estados de pieza del consultorio (V-25): bloquea T-16 / TASK-504.
2. Usuario de GitHub de la alumna.

## Próxima acción recomendada

Comprobar la CI del push (incluido E2E) y agregar `e2e (Playwright)` a la protección de `main`. Con eso la base queda completa y la alumna puede empezar por T-01 cuando tenga acceso.

## Autorizaciones

| Acción | Estado |
|---|---|
| STAGE | Autorizado (B-05/B-06, 2026-11-25) |
| COMMIT | Autorizado (B-05/B-06, 2026-11-25) |
| PUSH | Autorizado, directo a `main` (B-05/B-06, 2026-11-25) |
| Check E2E obligatorio en `main` | Autorizado (2026-11-25), tras pasar en GitHub |
| DEPLOY | No autorizado |
| Agregar colaboradora | Pendiente: falta su usuario de GitHub |
