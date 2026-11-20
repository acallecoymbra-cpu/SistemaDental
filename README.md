# Sistema Dental

Sistema de gestión para clínica / consultorio dental (DevSure).

**Estado:** planificación. Todavía no hay código de implementación.

## Por dónde empezar

| Documento | Qué es |
|---|---|
| [`docs/BRIEF-SISTEMA-DENTAL.md`](docs/BRIEF-SISTEMA-DENTAL.md) | Brief base para la IA planificadora: stack (Node 24, pnpm + Turborepo, Next.js, NestJS, TypeORM, React Native/Expo), reglas de base de datos, buenas prácticas, ciclo de memoria entre IAs y entregables esperados |
| [`docs/referencia/lumina-dental/`](docs/referencia/lumina-dental/README.md) | Copia de la demo «Lúmina Dental» del sitio DevSure (código, imágenes, diseño y pruebas), punto de partida del portal público y del flujo de citas |

Los requerimientos funcionales del propietario se añaden en la sección 3 del brief.

## Próximos pasos

1. La IA planificadora (ChatGPT) lee el brief y la referencia, hace sus preguntas y entrega `docs/PLAN.md`, `docs/DATA-MODEL.md`, los ADR y `docs/ai/ROADMAP.md`.
2. Claude Code implementa por vertical slices siguiendo `docs/ai/`.

## Repositorio

Forgejo será el repositorio canónico y GitHub un mirror de solo lectura (ver sección 10.4 del brief). Ninguno de los dos está configurado todavía.
