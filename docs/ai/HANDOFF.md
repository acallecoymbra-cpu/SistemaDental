# HANDOFF — continuidad

**as_of_sha:** `53d5812a99c4eb09d4da2b9437a04f10c2021fab` · **Fecha:** 2026-11-25 13:58 (America/La_Paz) · **Procedencia:** Claude Code, repositorio local y GitHub verificados; validaciones ejecutadas localmente.

## Resumen de continuidad (≤25 líneas)

- Proyecto: Renovando Sonrisas / Sistema Dental.
- Estado: base B-01…B-04 en `main` (`53d5812`, CI verde, `main` protegida). B-05 (molde de tratamientos) y B-06 (Playwright) verificadas localmente; en el commit siguiente a `53d5812`.
- Reparto aprobado: base B-01…B-06 por propietario/Claude Code; tareas T-01…T-18 por la alumna (`docs/PLAN-IMPLEMENTACION.md`). Guía para copiar el molde: `docs/GUIA-MOLDE-MODULO.md`.
- Requisitos: Word v4.2 modificado por las respuestas del cliente (`docs/VALIDACION-REQUISITOS.md` §6–§6.3).
- Validaciones: ver `STATUS.md`.
- B-05/B-06: STAGE, COMMIT y PUSH directo a `main` autorizados; check E2E obligatorio autorizado. DEPLOY: sin autorización.

## Última entrega — B-05 y B-06 (2026-11-25)

- El propietario decidió que el catálogo de tratamientos lo hiciéramos completo como molde para la alumna (en vez de dejarlo como su primera tarea).
- Detalle de archivos y pruebas en `STATUS.md`.
- Decisiones técnicas de la web: el navegador llama a `/api/*` en el mismo origen y Next lo reenvía a la API (`next.config.ts` → `API_URL`); la protección de páginas del panel es en el cliente (`SessionProvider`), la seguridad real sigue en la API.
- E2E: `pnpm test:e2e` ejecuta `e2e/prepare-db.mts` (crea y migra `sistema_dental_e2e`, crea `dra.e2e`) y luego Playwright con API en `:3101` y `next dev` en `:3100`.

## Notas de entorno

- Node 20 es el global (nvm-windows); las validaciones usan Node 24.22.3 anteponiendo su carpeta al `PATH`. A mano: `nvm use 24`.
- El contenedor `sistema-dental-postgres` sigue corriendo (`pnpm db:down` lo detiene). Bases: `sistema_dental`, `sistema_dental_test`, `sistema_dental_e2e`.
- Los archivos `.env*` están bloqueados para Claude Code: las variables nuevas las agrega el propietario.

## Punto exacto de reanudación

1. Re-verificar Git (no asumir que sigue en `53d5812`).
2. Comprobar los 3 trabajos de la CI del push de B-05/B-06.
3. Confirmar que `e2e (Playwright)` quedó como check obligatorio de `main` (autorizado).
4. Invitar a la alumna cuando el propietario entregue su usuario de GitHub; ella empieza por T-01 copiando el molde.
