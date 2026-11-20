# Referencia: demo «Lúmina Dental» de DevSure

> **Para la IA que lee esto:** esta carpeta es **material de referencia**, no el sistema nuevo. Es una copia del Concept Demo de clínica dental que DevSure publicó en su sitio. Úsala para entender la identidad visual, el tono, el catálogo de tratamientos y, sobre todo, el **flujo de solicitud de cita** que el sistema real debe hacer funcionar de verdad. El brief del sistema está en `../../BRIEF-SISTEMA-DENTAL.md` (sección «Punto de partida: la demo Lúmina Dental»).

## Origen

| | |
|---|---|
| Repositorio | DevSure `LandingPage` (Forgejo canónico; mirror de solo lectura en GitHub) |
| Commit copiado | `ec7b3cfa55bf66e0a56b8d286c9b918d77fa7ae9` (rama `fix/low-gpu-tier`; los archivos de la demo no tenían cambios locales) |
| Fecha de la copia | 2026-11-20 |
| Ruta en producción | `https://devsure.dev/portfolio/clinica-dental` |
| Commits de la demo | `1a22096` (demo inicial), `ce67504` (refinamiento de fotografía) |

La copia no se mantiene sincronizada: si la demo cambia en DevSure, la fuente de verdad es el repositorio de DevSure.

## Qué hay en la carpeta

| Carpeta | Contenido | Ruta original en DevSure |
|---|---|---|
| `codigo/clinica-dental/` | Todo el código de la demo (Next.js + React, CSS Module) | `apps/web/src/features/showcase/clinica-dental/` |
| `codigo/shared/focus-trap.ts` | Utilidad de accesibilidad que usa el diálogo de la agenda | `apps/web/src/features/showcase/shared/` |
| `imagenes/` | 6 fotografías WebP | `apps/web/public/portfolio/clinica-dental/` |
| `docs/` | Brief de diseño, prompt de diseño, handoff de diseño, handoff de fotografía, plan de pruebas e informe de QA | `docs/portfolio/*CLINICA-DENTAL*` |
| `pruebas/portfolio-clinica-dental.spec.ts` | Prueba E2E Playwright de la demo | `apps/web/tests/e2e/` |

Orden de lectura recomendado: `docs/PROJECT-DESIGN-BRIEF-CLINICA-DENTAL.md` → `docs/HANDOFF-CLINICA-DENTAL-LUMINA.md` → `codigo/clinica-dental/appointment-data.ts` → `codigo/clinica-dental/appointment-state.ts` → `codigo/clinica-dental/components/appointment-panel.tsx`.

## Mapa del código

| Archivo | Qué hace |
|---|---|
| `lumina-dental-showcase.tsx` | Composición de la página (secciones en orden) |
| `appointment-data.ts` | **Datos ficticios**: motivos de consulta, áreas/especialidades, tratamientos con duración, horarios, franjas horarias y reglas de calendario (días reservables, franjas «ocupadas» simuladas) |
| `appointment-state.ts` | **Máquina de estados pura** (reducer) del flujo de cita en 4 pasos: Motivo → Preferencia → Día y hora → Tus datos; validaciones y anuncios para lectores de pantalla. Sin red ni persistencia |
| `components/appointment-provider.tsx` | Contexto React que comparte ese estado entre la sección, el panel lateral (tablet) y el flujo a pantalla completa (móvil) |
| `components/appointment-panel.tsx` | La interfaz de la agenda: calendario, franjas, formulario, resumen y confirmación |
| `components/agenda-section.tsx`, `appointment-dialog.tsx`, `sticky-book-bar.tsx`, `book-link.tsx` | Contenedores y accesos a la agenda (sección, diálogo, barra fija en móvil, enlaces «Reservar» desde tratamientos) |
| `components/hero.tsx`, `hero-openings.tsx` | Portada y «próximos horarios disponibles» |
| `components/treatments.tsx` | Tarjetas de tratamientos que abren la agenda con el motivo precargado |
| `components/static-sections.tsx` | Especialidades, primera visita, principios, horarios, ubicación, pie |
| `components/lumina-header.tsx`, `icons.tsx` | Cabecera y conjunto de iconos SVG (incluye el símbolo del arco) |
| `lumina.module.css`, `fonts.ts`, `fonts.module.css` | Sistema visual completo (tokens de color, tipografía Fraunces + Figtree, radios, estados) |
| `ids.ts` | Ids de anclas compartidos |

## Qué es simulado (no existe en la demo)

- **No hay backend**: la confirmación de la cita no guarda, no envía y no reserva nada.
- La disponibilidad es **ficticia**: las franjas «ocupadas» se calculan con una regla determinista en `isSlotTaken`, no con citas reales.
- No hay odontólogos con nombre: el paso 2 elige un **área** de atención, nunca una persona.
- No hay pacientes, historia clínica, odontograma, cobros, usuarios ni panel de administración.
- Marca, textos, horarios y ubicación son ficticios. **«Lúmina Dental» es una marca de demostración**: el sistema real usará el nombre de la clínica del cliente.

## Qué se puede aprovechar en el sistema real

| De la demo | En el sistema real |
|---|---|
| `REASONS` (motivos) y `FEATURED_TREATMENTS` / `MORE_TREATMENTS` | Semilla inicial del **catálogo de procedimientos / tipos de cita** (nombre, descripción, duración), ahora administrable desde el panel |
| `PROFESSIONALS` (áreas) y `SPECIALTIES` | Tabla de **especialidades**, relacionada con odontólogos reales |
| `TIME_SLOTS`, `WEEK_HOURS`, `isDateBookable` | **Horarios de atención** y reglas de disponibilidad, ahora calculados en la API a partir de la agenda real |
| `AppointmentState` (motivo, preferencia, fecha, hora, nombre, teléfono, email, comentario, primera visita) | Campos de la **solicitud de cita pública** (`appointment_request`), que la recepción confirma y convierte en cita |
| Reducer de 4 pasos + validaciones | Flujo de reserva del paciente (web y, si se aprueba, app móvil), con la disponibilidad pedida a la API |
| Sistema visual (`lumina.module.css`, tokens, tipografías, arco) | Base de la **identidad del portal público** de la clínica; el panel interno puede usar una versión más sobria de los mismos tokens |
| Accesibilidad (región `aria-live`, gestión de foco, `focus-trap`) | Mismo nivel de accesibilidad en el sistema |
| Prueba E2E y plan de pruebas | Modelo de cómo escribir las pruebas del flujo de reserva real |

## Dependencias de la demo que no vienen en la carpeta

El código no compila aislado: importa `next/image`, `next/link`, `next/font/google` (Fraunces y Figtree) y usa rutas relativas a `public/`. En el proyecto nuevo, adaptarlo en lugar de copiarlo tal cual.

## Licencia de las fotografías

Las 6 fotos vienen de **Pexels** (licencia Pexels, «Free to use»), comprobada en la página de cada foto el 2026-10-07. El detalle por foto (ID, autor, recorte) está en `docs/HANDOFF-CLINICA-DENTAL-PHOTO-REFINEMENT.md`. Para un cliente real conviene usar fotografías propias de la clínica.

## Notas

- Algunos documentos de `docs/` enlazan a archivos del repositorio de DevSure (`DEVSURE-PROJECT-SHOWCASE-SYSTEM.md`, otros demos) que no se copiaron; no son necesarios para el sistema dental.
- El enlace al lienzo de diseño que aparece en el handoff es privado del autor; el handoff ya describe lo necesario.
