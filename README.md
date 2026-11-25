# Sistema Dental — Renovando Sonrisas

Sistema web de gestión para el consultorio dental Renovando Sonrisas.

**Estado:** fundaciones del monorepo creadas (TASK-002); todavía sin base de datos ni funcionalidad de negocio. Estado vigente en [`docs/ai/STATUS.md`](docs/ai/STATUS.md).

## Por dónde empezar

| Documento | Qué es |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Reglas del proyecto y bootstrap obligatorio para agentes |
| [`docs/ai/`](docs/ai/) | Memoria versionada: PROTOCOL, MASTER, STATUS, HANDOFF, ROADMAP, DECISIONS |
| [`docs/VALIDACION-REQUISITOS.md`](docs/VALIDACION-REQUISITOS.md) | Trazabilidad RF/RNF, discrepancias y preguntas al cliente |
| [`docs/PLAN.md`](docs/PLAN.md) | Visión, alcance, arquitectura, pantallas y riesgos |
| [`docs/PLAN-IMPLEMENTACION.md`](docs/PLAN-IMPLEMENTACION.md) | Tareas de implementación (base, tareas del equipo, cierre) y reglas de trabajo |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Modelo relacional propuesto y diagrama ER |
| [`docs/BRIEF-SISTEMA-DENTAL.md`](docs/BRIEF-SISTEMA-DENTAL.md) | Brief técnico y de método (stack, reglas de BD, ciclo de memoria entre IAs) |
| [`docs/referencia/lumina-dental/`](docs/referencia/lumina-dental/README.md) | Demo ficticia «Lúmina Dental» de DevSure: referencia visual y del flujo de cita, no funcionalidad real |

## Fuentes

- **Alcance funcional:** documento de requerimientos `Doc_Dentista_v4.2.docx` (pendiente de validación; no versionado en este repositorio).
- **Método y stack:** el brief, sujeto a los ADR de `docs/ai/DECISIONS.md`.

## Desarrollo

Requisitos: Node **24** (`.nvmrc`), pnpm **12.18.0** (`packageManager`) y Docker Desktop.

```bash
pnpm install
cp .env.example .env   # valores solo para desarrollo local (incluye WEB_ORIGINS)
pnpm db:up             # PostgreSQL 17 en Docker (bases sistema_dental y sistema_dental_test)
pnpm build             # contracts, api y web
pnpm db:migrate        # aplica las migraciones a la base de desarrollo
pnpm lint
pnpm typecheck
pnpm test              # pruebas unitarias (sin base de datos)
pnpm test:integration  # pruebas contra PostgreSQL real (base *_test)
pnpm dev               # api en :3001 (GET /api/v1/health) y web en :3000
```

La base de datos solo cambia por migraciones (`apps/api/src/database/migrations`, `synchronize: false`). Crear una nueva: `pnpm --filter @sistema-dental/api migration:create src/database/migrations/NombreDeLaMigracion`.

Estructura: `apps/api` (NestJS 11), `apps/web` (Next.js 15), `packages/contracts` (tipos y enums compartidos), `packages/config` (tsconfig y ESLint compartidos).

## Próximos pasos

Ver [`docs/ai/ROADMAP.md`](docs/ai/ROADMAP.md): validación de requisitos y ADR (TASK-001) antes de iniciar el monorepo.

## Repositorio

Repositorio **público** en GitHub por decisión del propietario (ADR-008). No se versionan datos de pacientes, archivos clínicos, secretos ni el documento de requisitos del cliente. Forgejo como repositorio canónico sigue pendiente.
