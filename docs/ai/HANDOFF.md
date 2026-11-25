# HANDOFF — continuidad

**as_of_sha:** `12a81b093dce2941db5d6b25a4ca3fac32f23fc8` · **Fecha:** 2026-11-25 11:47 (America/La_Paz) · **Procedencia:** Claude Code, repositorio local y GitHub verificados; validaciones ejecutadas localmente.

## Resumen de continuidad (≤25 líneas)

- Proyecto: Renovando Sonrisas / Sistema Dental.
- Estado: base B-01 y B-02 en `12a81b0` con CI verde en GitHub; `main` protegida. B-03 verificada localmente; en el commit siguiente a `12a81b0`.
- Reparto aprobado: base B-01…B-06 por propietario/Claude Code; tareas T-01…T-18 por la alumna (`docs/PLAN-IMPLEMENTACION.md`).
- Requisitos: Word v4.2 modificado por las respuestas del cliente (`docs/VALIDACION-REQUISITOS.md` §6–§6.3).
- Validaciones: ver `STATUS.md`.
- B-03: push directo a `main` autorizado (incluye stage y commit). DEPLOY: sin autorización.

## Entregas de esta sesión (2026-11-25)

1. Commit `12a81b0` (B-01, B-02 y plan de implementación) y push autorizados; CI en GitHub verde.
2. Protección de `main` aplicada con `gh api` (ver reglas en `STATUS.md`).
3. Guía local para el propietario (fuera del repo): `C:\Users\aliva\Documents\Claude-Docs\SistemaDental\Guia-monorepo-desde-cero.md`.
4. B-03: ver detalle en `STATUS.md`; ADR-011 aceptada. Guía local ampliada con la sección de seguridad base.

## Notas de entorno

- Node 20 es el global (nvm-windows); las validaciones usan Node 24.22.3 anteponiendo su carpeta al `PATH`. A mano: `nvm use 24`.
- El contenedor `sistema-dental-postgres` sigue corriendo (`pnpm db:down` lo detiene).
- Los archivos `.env*` están bloqueados para Claude Code por los permisos de la sesión: cualquier variable nueva la agrega el propietario.
- El correo de la alumna no se guarda en el repositorio (es público); para invitarla hace falta su usuario de GitHub.

## Punto exacto de reanudación

1. Re-verificar Git (no asumir que sigue en `12a81b0`).
2. Confirmar que `.env.example` y `.env` tienen `WEB_ORIGINS` y `TRUST_PROXY`.
3. Con autorización separada: STAGE, COMMIT, PUSH de B-03 (como `main` está protegida, el propietario puede empujar directo o abrir un PR).
4. B-04: login del dentista (Argon2, sesión opaca en BD, cookie `httpOnly`/`Secure`/`SameSite=Lax`, bloqueo 5 intentos/15 min, inactividad 30 min) y auditoría mínima.
