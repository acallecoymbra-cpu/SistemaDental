# HANDOFF — continuidad

**as_of_sha:** `380478248a5d9afb1bd735a68592a1ee60174774` · **Fecha:** 2026-11-25 14:15 (America/La_Paz) · **Procedencia:** Claude Code, repositorio local y GitHub verificados; validaciones ejecutadas localmente y en la CI.

## Resumen de continuidad (≤25 líneas)

- Proyecto: Renovando Sonrisas / Sistema Dental.
- Estado: **base B-01…B-06 terminada** en `main` (`3804782`), CI verde con 3 trabajos, `main` protegida con 3 checks obligatorios.
- Reparto aprobado: tareas T-01…T-18 por la alumna (`docs/PLAN-IMPLEMENTACION.md`), copiando el molde de tratamientos (`docs/GUIA-MOLDE-MODULO.md`). Cierre C-01…C-04 por el propietario.
- Requisitos: Word v4.2 modificado por las respuestas del cliente (`docs/VALIDACION-REQUISITOS.md` §6–§6.3).
- Validaciones: ver `STATUS.md`.
- README reescrito como guía paso a paso para levantar el proyecto (para la alumna); `.env.example` con las variables nuevas. Push autorizado. DEPLOY: sin autorización.

## Última sesión (2026-11-25)

1. B-01…B-06 versionadas y subidas a `main` con autorización del propietario (commits en `STATUS.md`).
2. Protección de `main` creada y luego ampliada con `e2e (Playwright)`.
3. Corrección: `AUDIT_IP_SALT` vacía ya no impide arrancar fuera de producción.
4. `.env` local del propietario verificado de forma indirecta (ver `STATUS.md`).
5. `pnpm dev` corregido: la API ahora arranca con `nest start --watch`; probado por el propietario.
6. Guía local del propietario: `C:\Users\aliva\Documents\Claude-Docs\SistemaDental\Guia-monorepo-desde-cero.md` (secciones 0–20).

## Notas de entorno

- Node 20 es el global (nvm-windows); las validaciones usan Node 24.22.3 anteponiendo su carpeta al `PATH`. A mano: `nvm use 24`.
- Docker Desktop puede cerrarse; antes de trabajar: abrirlo y `pnpm db:up`. Bases: `sistema_dental`, `sistema_dental_test`, `sistema_dental_e2e`.
- Los archivos `.env*` están bloqueados para Claude Code: las variables nuevas las agrega el propietario.
- El correo de la alumna no se guarda en el repositorio (público).

## Punto exacto de reanudación

1. Re-verificar Git (no asumir que sigue en `3804782`).
2. Invitar a la alumna (`gh api -X PUT repos/acallecoymbra-cpu/SistemaDental/collaborators/<usuario> -f permission=push`) cuando el propietario dé su usuario.
3. Revisar los Pull Requests de T-01 en adelante contra `docs/GUIA-MOLDE-MODULO.md` y la tarjeta de cada tarea.
