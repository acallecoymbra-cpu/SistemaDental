# AGENTS.md — Sistema Dental Renovando Sonrisas (borrador)

## Objetivo

Construir un sistema web según `Doc_Dentista_v4.2.docx` aprobado. En tanto esté pendiente de validación, usarlo como propuesta de contrato, con puntos abiertos en `docs/VALIDACION-REQUISITOS.md`.

## Bootstrap obligatorio

1. Confirmar directorio actual, `git status --short`, `git rev-parse HEAD`, `git branch -vv`, remotos y SHA remoto observado. No asumir Git limpio ni mirror configurado.
2. Nivel 0: leer `AGENTS.md`, `docs/ai/PROTOCOL.md`, `docs/ai/MASTER.md`, sección vigente de `STATUS.md` y resumen de `HANDOFF.md`.
3. Nivel 1: `ROADMAP.md`, `DECISIONS.md`, `DATA-MODEL.md`, `MODULE.md` del módulo afectado, reglas RF/RNF asociadas.
4. Nivel 2: código/documentos referencia solo cuando aporten al objetivo.

## Reglas estrictas

- El Word v4.2 define alcance funcional; el brief técnico define método; Lúmina es **demo**: ni su disponibilidad ni sus confirmaciones constituyen backend real.
- No inventar implementaciones, estado Git, tests pasados ni aprobaciones.
- No añadir roles, IA, pagos automáticos, WhatsApp API o móvil sin un requisito aprobado.
- Prohibidos secretos, datos reales de pacientes y archivos médicos en Git/logs/fixtures.
- No realizar **STAGE**, **COMMIT**, **PUSH** ni **DEPLOY** sin autorización explícita **separada** para cada acción.
- Fuentes de verdad: código y tests verificables para estado real; `DECISIONS.md` para decisiones; `ROADMAP.md` para planificación.
- Inmutabilidad de versiones clínicas y auditoría; transacciones/garantía BD para solapes.
- `synchronize: false`; cambios de BD mediante migraciones con tests.
- Hacer cambios por vertical slices revisables; reportar exactamente validaciones ejecutadas y no ejecutadas.

## Cierre de una tarea

Actualizar `STATUS.md` y `HANDOFF.md` con `as_of_sha`, fecha/hora, procedencia, cambios y autorizaciones pendientes. Actualizar ADR/roadmap/modelo si el contrato cambió; solicitar aprobación del propietario antes de cualquier acción Git.
