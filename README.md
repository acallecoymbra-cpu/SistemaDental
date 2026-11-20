# Sistema Dental — Renovando Sonrisas

Sistema web de gestión para el consultorio dental Renovando Sonrisas.

**Estado:** planificación (borrador, pendiente de aprobación). Todavía no hay código de implementación. Estado vigente en [`docs/ai/STATUS.md`](docs/ai/STATUS.md).

## Por dónde empezar

| Documento | Qué es |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Reglas del proyecto y bootstrap obligatorio para agentes |
| [`docs/ai/`](docs/ai/) | Memoria versionada: PROTOCOL, MASTER, STATUS, HANDOFF, ROADMAP, DECISIONS |
| [`docs/VALIDACION-REQUISITOS.md`](docs/VALIDACION-REQUISITOS.md) | Trazabilidad RF/RNF, discrepancias y preguntas al cliente |
| [`docs/PLAN.md`](docs/PLAN.md) | Visión, alcance, arquitectura, pantallas y riesgos |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Modelo relacional propuesto y diagrama ER |
| [`docs/BRIEF-SISTEMA-DENTAL.md`](docs/BRIEF-SISTEMA-DENTAL.md) | Brief técnico y de método (stack, reglas de BD, ciclo de memoria entre IAs) |
| [`docs/referencia/lumina-dental/`](docs/referencia/lumina-dental/README.md) | Demo ficticia «Lúmina Dental» de DevSure: referencia visual y del flujo de cita, no funcionalidad real |

## Fuentes

- **Alcance funcional:** documento de requerimientos `Doc_Dentista_v4.2.docx` (pendiente de validación; no versionado en este repositorio).
- **Método y stack:** el brief, sujeto a los ADR de `docs/ai/DECISIONS.md`.

## Próximos pasos

Ver [`docs/ai/ROADMAP.md`](docs/ai/ROADMAP.md): validación de requisitos y ADR (TASK-001) antes de iniciar el monorepo.

## Repositorio

Repositorio **público** en GitHub por decisión del propietario (ADR-008). No se versionan datos de pacientes, archivos clínicos, secretos ni el documento de requisitos del cliente. Forgejo como repositorio canónico sigue pendiente.
