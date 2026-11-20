# HANDOFF — continuidad

**as_of_sha:** `8251eacee5068f0a559c1ce88e53b4006970b5a7` · **Fecha:** 2026-11-20 15:22 (America/La_Paz) · **Procedencia:** Claude Code, repositorio local verificado.

## Resumen de continuidad (≤25 líneas)

- Proyecto: Renovando Sonrisas / Sistema Dental.
- Estado: revisión de requerimientos y planificación, no desarrollo.
- Fuente: Word v4.2 (18/11/2026), pendiente de validación; no versionado en el repo.
- Repositorio: único remoto GitHub `acallecoymbra-cpu/SistemaDental` (PUBLIC), `main` = `8251eac`; Forgejo no configurado.
- Paquete de planificación en directorio de trabajo, **untracked**.
- Documento de alcance: `docs/PLAN.md`.
- Riesgos/preguntas: `docs/VALIDACION-REQUISITOS.md`.
- Modelo DB propuesto: `docs/DATA-MODEL.md`.
- Decisiones no aprobadas: `docs/ai/DECISIONS.md` (ninguna ACEPTADA).
- Roadmap: `docs/ai/ROADMAP.md`; siguiente TASK-001.
- Validaciones: NO EJECUTADAS; nada implementado.
- STAGE/COMMIT/PUSH/DEPLOY: sin autorización.

## Última entrega — auditoría de integración y correcciones documentales (2026-11-20)

Auditoría del paquete frente a `docs/BRIEF-SISTEMA-DENTAL.md` y `docs/referencia/lumina-dental/`. Correcciones aplicadas, solo documentación:

- `STATUS.md` / `HANDOFF.md`: estado Git local verificado, procedencia y visibilidad pública observada.
- `README.md`: estado actual, fuentes y remoto real.
- `docs/DATA-MODEL.md`: restricción de solapes usa `status='confirmada'` (antes `confirmed`); columnas `currency` (`BOB`) junto a cada importe; importes en `bigint` (ADR-002).
- `docs/PLAN.md`: `appointment.starts_at` (singular); nota que reemplaza la tabla «Qué se puede aprovechar» del README de Lúmina.
- `docs/ai/MASTER.md`: misma nota de precedencia sobre la referencia Lúmina.
- `docs/ai/ROADMAP.md`: TASK-102 incluye auditoría de lectura clínica; TASK-005 marcada como entregada pendiente de versionar.

Decisiones del propietario (misma fecha):

- `00-LEEME.md` y `docs/IMPLEMENTATION-HANDOFF.md` descartados; movidos fuera del repo a `C:\Users\aliva\Documents\Claude-Docs\SistemaDental\descartados-2026-11-20\`.
- `Doc_Dentista_v4.2.docx` queda fuera del repositorio.
- GitHub permanece público → ADR-008 parcialmente aceptada; README y riesgo en `PLAN.md` actualizados.

No modificados: `docs/referencia/`, `AGENTS.md`, `PROTOCOL.md`, `VALIDACION-REQUISITOS.md`; normalizar etiquetas de estado en `DECISIONS.md` queda pendiente.

## Punto exacto de reanudación

1. Re-verificar Git (no asumir que sigue en `8251eac`).
2. Con autorización separada: STAGE (README + `AGENTS.md` + `docs/{PLAN,DATA-MODEL,VALIDACION-REQUISITOS}.md` + `docs/ai/*`), luego COMMIT, luego PUSH.
3. TASK-001: registrar respuestas y decisiones ACEPTADAS con fecha/evidencia.
