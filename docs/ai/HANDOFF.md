# HANDOFF — continuidad

**as_of_sha:** `bbb34c76492d5470d0c8a49e2f577f411a11065d` (rama `feat/reservas-agenda-historia-clinica`, 76 archivos sin versionar) · **Fecha:** 2026-11-27 17:45 (America/La_Paz) · **Procedencia:** Claude Code, repositorio local; validaciones completas ejecutadas localmente (ver `STATUS.md`); PR/CI NO VERIFICADO (`gh` no instalado).

## Resumen de continuidad (≤25 líneas)

- Proyecto: Renovando Sonrisas / Sistema Dental.
- `main` (`origin` y `upstream`): `8402a8f`. Rama `feat/reservas-agenda-historia-clinica` (`bbb34c7`, solo en el fork): T-01…T-18 salvo T-16.
- **Sin versionar:** V-26 (CI del paciente) y V-27 (nombre por partes; «Mis consultas» y paciente que vuelve con primer nombre + primer apellido + país + celular; selector de país, Bolivia por defecto). VERIFIED localmente: integración 275/275, E2E 85 + 1 omitida, unitarias, lint, typecheck y build en verde. Revisado; 3 hallazgos importantes corregidos.
- V-26/V-27 son **PROPUESTA** hasta que el propietario confirme (`VALIDACION-REQUISITOS.md` §6.4).
- Corregidos además: límite RF-09 compartido con la reserva «ya estoy registrado» y la confirmación de pago concurrente (ya no da 409). Integración 275/275.
- Bloqueadores: estados de pieza (T-16), proveedor de correo, confirmación de V-26/V-27.
- STAGE/COMMIT/PUSH: pendientes de autorización. DEPLOY: no autorizado.

## Última sesión (2026-11-27)

1. Análisis de `docs/` y del código; STATUS/HANDOFF puestos al día.
2. Entorno local: Node 24, dentista `dra.prueba`, intervalo del 28/11, WhatsApp de la clínica (solo base local).
3. Diseño, plan e implementación de V-26/V-27 con TDD; revisión independiente; corrección de: apoderado no revisado en el registro web, WhatsApp extranjero largo (500), carrera de registros ambiguos.
4. Documentación: VALIDACION §6.4, DATA-MODEL, nota en ADR-003, MODULE.md.

## Notas de entorno

- `nvm use 24` antes de cualquier comando; `pnpm` vía `corepack pnpm`. `pnpm db:up` y luego `pnpm db:migrate` (la última migración es `1765200000000`).
- E2E usa puertos 3100/3101 y la base `sistema_dental_e2e` (se recrea en cada corrida).
- Los archivos `.env*` no los lee Claude Code.
- Repositorio público: nunca datos reales, secretos ni el número real del consultorio en código o pruebas.

## Punto exacto de reanudación

1. Re-verificar Git (no asumir que los cambios siguen sin versionar).
2. Con autorización: STAGE y COMMIT (por separado) y PUSH al fork.
3. Esperar las respuestas de T-16 (`docs/ODONTOGRAMA-T16.md` §9) y la confirmación de V-26/V-27.
