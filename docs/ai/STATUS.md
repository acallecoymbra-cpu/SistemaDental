# STATUS — Estado vigente

**Fecha de captura:** 2026-11-25 14:15 (America/La_Paz, -04:00).
**Procedencia:** inspección del repositorio local `C:\dev\sistema-dental` y de GitHub por Claude Code (`git status`, `git log`, `git ls-remote`, `gh run watch`, `gh api .../branches/main/protection`) y ejecución local de validaciones. Forgejo: NO VERIFICADO (no configurado como remoto).
**as_of_sha (HEAD local = origin/main observado):** `380478248a5d9afb1bd735a68592a1ee60174774`.

## Estado

- **Base B-01…B-06 completa** en `main` (`3804782`). CI de `3804782` en verde con sus 3 trabajos (run `45670421896`): validación, integración y E2E.
- `main` protegida: PR con 1 aprobación, historia lineal, sin force-push ni borrado, conversaciones resueltas y **3 checks obligatorios** (`lint · typecheck · test · build`, `integración (PostgreSQL)`, `e2e (Playwright)`, este último agregado el 2026-11-25 con autorización). El propietario puede saltarse las reglas (`enforce_admins` desactivado).
- ADR-011 y ADR-012 aceptadas.
- Colaboradora (alumna): pendiente; falta su usuario de GitHub.
- Remoto único `origin` → GitHub `acallecoymbra-cpu/SistemaDental`, **público** por el momento (ADR-008).

## Qué hay en `main`

| Bloque | Contenido | Commit |
|---|---|---|
| TASK-002 | Monorepo pnpm/Turborepo, API NestJS 11, web Next.js 15, `contracts`, `config` | `93d7a3d` |
| B-01, B-02 | CI; PostgreSQL 17 en Docker; TypeORM 0.3 con migraciones | `12a81b0` |
| B-03 | Seguridad HTTP base (ADR-011) | `754d344` |
| B-04 | Login, sesiones, bloqueo, auditoría inmutable, CLI `dentist:create` (ADR-012) | `53d5812` |
| B-05, B-06 | Molde de tratamientos (API + web + pruebas), base web, Playwright, guía `docs/GUIA-MOLDE-MODULO.md`; corrección de `AUDIT_IP_SALT` vacía | `3804782` |

## Entorno local del propietario (verificado el 2026-11-25)

- `.env` local: verificado de forma indirecta (Claude Code no puede leer `.env*`). La API arranca; health `database: up`; login con `Origin: http://localhost:3000` → 401 (origen aceptado); otro origen → 403; CORS devuelve `http://localhost:3000`.
- `.env.example`: el propietario agregó las variables nuevas y confirmó que no contiene secretos reales (Claude Code no puede leerlo); se versiona en el commit siguiente a `3804782`.
- Base `sistema_dental` migrada hasta `CreateTreatments1764300000000`. El propietario creó su dentista de desarrollo y probó `pnpm dev` con éxito (2026-11-25).
- Corrección (commit siguiente a `b372b6f`): el script `dev` de la API solo compilaba y no arrancaba el servidor; ahora usa `nest start --watch` (`@nestjs/cli` 11.0.24, `nest-cli.json`). Verificado: arranca (health 200) y se reinicia al cambiar un archivo.
- El puerto 3000 lo ocupaba el contenedor ajeno `open-webui-old`; el propietario lo liberó. README: nuevas filas en «Problemas frecuentes» (carpeta equivocada y puerto ocupado).

## Validaciones ejecutadas (2026-11-25, Windows 11, Node 24.22.3, pnpm 12.18.0, Docker 29.6.1)

| Comando | Local | GitHub (run `45670421896`) |
|---|---|---|
| `prettier --check .`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | PASS | PASS |
| `pnpm test` | PASS: api 33, contracts 4, web 3 | PASS |
| `pnpm test:integration` | PASS: 32 | PASS |
| `pnpm test:e2e` | PASS: 12 | PASS |

No ejecutado: login manual en el navegador con `pnpm dev` (falta crear el dentista de desarrollo).

## Bloqueadores

1. Lista de estados de pieza del consultorio (V-25): bloquea T-16 / TASK-504.
2. Usuario de GitHub de la alumna: bloquea su acceso y el inicio de T-01.

## Próxima acción recomendada

Invitar a la alumna cuando haya usuario; ella empieza por T-01 (configuración de la clínica) copiando el molde. Pendientes de la etapa de cierre (C-01…C-04) quedan para el propietario.

## Autorizaciones

| Acción | Estado |
|---|---|
| PUSH de la corrección de `pnpm dev` y del README | Autorizado por el propietario (2026-11-25), incluye stage y commit |
| DEPLOY | No autorizado |
| Agregar colaboradora | Pendiente: falta su usuario de GitHub |
