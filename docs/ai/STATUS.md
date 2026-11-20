# STATUS — Estado vigente

**Fecha de captura:** 2026-11-20 15:22 (America/La_Paz, -04:00).
**Procedencia:** inspección del repositorio local `C:\dev\sistema-dental` por Claude Code (`git status`, `git rev-parse HEAD`, `git branch -vv`, `git remote -v`, `git ls-remote origin`) y `gh repo view` (visibilidad). Forgejo: NO VERIFICADO (no configurado como remoto).
**as_of_sha (HEAD local = origin/main observado):** `8251eacee5068f0a559c1ce88e53b4006970b5a7`.

## Estado

- `PLANNING / DRAFT`: requerimientos v4.2 aún pendientes de aprobación del cliente.
- Remoto único `origin` → GitHub `acallecoymbra-cpu/SistemaDental`, rama `main`, visibilidad **PUBLIC** (observada). No hay remoto Forgejo.
- Versionado en `main`: README, `.gitattributes`, `.gitignore`, `.nvmrc`, brief y referencia Lúmina.
- Paquete de planificación (`AGENTS.md`, `docs/{PLAN,DATA-MODEL,VALIDACION-REQUISITOS}.md`, `docs/ai/*`) presente en el directorio de trabajo **sin seguimiento (untracked)**; `README.md` modificado. Nada de ello está en un commit.
- `00-LEEME.md` y `docs/IMPLEMENTATION-HANDOFF.md` descartados por el propietario (movidos fuera del repo a `C:\Users\aliva\Documents\Claude-Docs\SistemaDental\descartados-2026-11-20\`).
- ADR-008 parcialmente aceptada: GitHub permanece público; `.docx` de requisitos fuera del repo.
- Auditoría de integración realizada el 2026-11-20; correcciones documentales aplicadas (ver `HANDOFF.md`).
- No existe monorepo ejecutable (`apps`, `packages`), backend ni persistencia del sistema real.
- `Doc_Dentista_v4.2.docx` no está en el repositorio (copia local fuera del repo).
- Tests: **NOT EXECUTED** (no hay código; no se ejecutó build/lint/test/E2E).

## Bloqueadores

1. Responder dudas críticas de `docs/VALIDACION-REQUISITOS.md` (TASK-001).
2. Aprobar motor, PK, identidad de pacientes, reglas de vencimiento y solapes históricos.
3. ADR-008 (resto): decidir si Forgejo será canónico (no bloquea el versionado actual).

## Próxima acción recomendada

STAGE/COMMIT/PUSH del paquete con autorización separada para cada operación; después TASK-001. No iniciar TASK-002 sin cierre de decisiones críticas.

## Autorizaciones

| Acción | Estado |
|---|---|
| STAGE | No autorizado |
| COMMIT | No autorizado |
| PUSH | No autorizado |
| DEPLOY | No autorizado |
