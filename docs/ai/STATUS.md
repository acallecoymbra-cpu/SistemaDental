# STATUS — Estado vigente

**Fecha de captura:** 2026-11-27 17:45 (America/La_Paz, -04:00).
**Procedencia:** Claude Code en el repositorio local `/home/ruth/Documents/Dental_Clinic/SistemaDental` (Linux): `git status`, `git log`, `git ls-remote` de `origin` y `upstream` (16:04), lectura de código y ejecución local de todas las validaciones (ver abajo). `gh` no está instalado: PR, CI y protección de `main` **NO VERIFICADO**. Forgejo: NO VERIFICADO.
**as_of_sha (HEAD local):** `bbb34c76492d5470d0c8a49e2f577f411a11065d` en `feat/reservas-agenda-historia-clinica`, **con 76 archivos cambiados o nuevos sin versionar** (ver «Trabajo local sin versionar»).

## Git observado (16:04)

| Referencia | SHA |
|---|---|
| HEAD local (`feat/reservas-agenda-historia-clinica`) | `bbb34c7` |
| `origin/feat/reservas-agenda-historia-clinica` | `bbb34c7` |
| `origin/main` = `upstream/main` = `main` local | `8402a8f` |
| `feat/t-02-intervalos-atencion` (solo local) | `8402a8f` |

- Remotos: `origin` → fork `MarleneRuth/SistemaDental`; `upstream` → `acallecoymbra-cpu/SistemaDental` (**público**, ADR-008).
- `bbb34c7` (T-01…T-18 salvo T-16, en un solo commit) **no está en `main`**. PR hacia `upstream`: NO VERIFICADO.

## Estado

- Base B-01…B-06 en `main`. T-01…T-18 salvo T-16 en `bbb34c7` (rama del fork).
- **Nuevo, sin versionar (2026-11-27):** CI del paciente, nombre por partes y celular con código de país (V-26/V-27, **PROPUESTA** hasta que el propietario confirme). Diseño: `docs/superpowers/specs/2026-11-27-paciente-ci-nombres-celular-design.md`; plan: `docs/superpowers/plans/2026-11-27-paciente-ci-nombres-celular.md`. Estado: **VERIFIED localmente** (validaciones abajo), revisado por un revisor independiente y corregidos sus 3 hallazgos importantes.
- Desvío de proceso pendiente de decisión del propietario: `bbb34c7` reúne 17 tareas en un commit (el plan pide un PR por tarea).

## Trabajo local sin versionar (sobre `bbb34c7`)

1. **V-26/V-27** — migración `1765200000000-PatientNamePartsCiPhoneCountry` (columnas de nombre por partes y claves, `phone_country_code`, `guardian_phone_country_code`, `ci`; datos migrados; WhatsApp de 8 dígitos → `+591…`); contratos (`phone.ts`, tipos nuevos); API de pacientes, reserva (`kind: 'new' | 'returning'`), «Mis consultas» (primer nombre + primer apellido + país + celular), WhatsApp de la clínica validado por país (E.164, máx. 15 dígitos); pantallas con selector de país (Bolivia por defecto) y CI; pruebas nuevas y adaptadas.
2. Previo a hoy: componente `PhoneInput` (filtro de caracteres), `complete()` guarda `completed_at`/`completed_by`, mensajes en español en los DTO de login (archivo de la base B-04).
3. **Límite RF-09 compartido:** la reserva «ya estoy registrado» sin coincidencias cuenta como intento fallido junto con «Mis consultas» (5 en 10 min ⇒ ambos caminos bloqueados 15 min). Antes no tenía límite y permitía probar nombre + celular sin fin.
4. Documentos: este STATUS, HANDOFF, `VALIDACION-REQUISITOS.md` §6.4, `DATA-MODEL.md` (`patient`), `DECISIONS.md` (nota ADR-003), `MODULE.md` de pacientes y citas, `docs/ODONTOGRAMA-T16.md` (propuesta de la desarrolladora), spec y plan.

## Validaciones ejecutadas (2026-11-27, Linux, Node 24.22.1, pnpm 12.18.0 vía corepack, Docker 29.10.1)

| Comando | Línea base (antes del cambio) | Final |
|---|---|---|
| `prettier --check .`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | PASS | PASS |
| `pnpm test` | contracts 21, api 38, web 28 | contracts 38, api 38, web 30: PASS |
| `pnpm test:integration` | 251/251 | 275/275 PASS |
| `pnpm test:e2e` | 81 passed, 1 skipped | 85 passed, 1 skipped (escritorio y 360 px) |

Además: migración aplicada a la base de desarrollo `sistema_dental`; capturas de `/reservar` a 1280 y 360 px sin desborde horizontal.

## Hallazgos abiertos

0. Propuesta para el propietario (no implementada): límite adicional por número de celular (además del de IP) y verificación de `TRUST_PROXY` detrás de Nginx en el VPS (C-02).

1. **Corregido (2026-11-27):** confirmación de pago concurrente daba 409 a veces (prueba intermitente). Causa: `SELECT … LEFT JOIN payment_proof … FOR UPDATE OF a`; tras esperar el bloqueo, PostgreSQL releía la cita pero no el comprobante. Ahora se bloquea la cita y se lee el comprobante en otra consulta (`appointment-actions.service.ts`). Prueba nueva: 15 rondas de 6 confirmaciones en paralelo (fallaba 3 de 3 antes; pasa 5 de 5 después).
2. Menores diferidos de la revisión: errores crudos de la migración con nombres legados muy largos o colisiones de claves (solo bases de desarrollo); los buscadores del panel/agenda solo quitan el prefijo 591; doble *cast* en `appointments.service.ts`; `PhoneInput` fija el país inicial al montar.

## Entorno de este equipo

- Node activo por defecto 22.23.5: usar `nvm use 24` (24.22.1). `pnpm` vía `corepack`. `gh` no instalado.
- Base de desarrollo local: dentista activo `dra.prueba` (el anterior `dra.ejemplo` desactivado); WhatsApp de la clínica configurado; intervalo de atención 28/11/2026 08:00–12:00. Solo datos locales, nada de esto está en Git.

## Bloqueadores

1. Lista de estados de pieza (V-25) y respuestas de `docs/ODONTOGRAMA-T16.md` §9: bloquean T-16.
2. Proveedor de correo sin elegir (RF-21, RNF-12).
3. Confirmación del propietario de V-26/V-27.

## Próxima acción recomendada

1. Autorizar STAGE y COMMIT del trabajo local (por separado), luego PUSH al fork.
2. Propietario: confirmar V-26/V-27 y decidir cómo revisar `bbb34c7` + este cambio.

## Autorizaciones

| Acción | Estado |
|---|---|
| STAGE / COMMIT del trabajo local | Pendiente de autorización |
| PUSH de `feat/reservas-agenda-historia-clinica` | Pendiente de autorización |
| Merge a `main` (`upstream`) | Requiere PR y aprobación del propietario |
| DEPLOY | No autorizado |
