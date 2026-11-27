# Módulo `treatments` — catálogo de tratamientos (molde B-05)

**Requisitos:** RF-01 (portal muestra activos), RF-15 (dentista crea, edita, activa y desactiva).
**Tabla:** `treatment` (migración `CreateTreatments1764300000000`), con semilla de los 7 tratamientos del Word v4.2.

## Endpoints

| Método y ruta                        | Acceso   | Respuesta                                                |
| ------------------------------------ | -------- | -------------------------------------------------------- |
| `GET /api/v1/treatments`             | Público  | `PublicTreatment[]`: solo activos, ordenados por nombre  |
| `GET /api/v1/admin/treatments`       | Dentista | `AdminTreatment[]`: todos, activos primero               |
| `POST /api/v1/admin/treatments`      | Dentista | `AdminTreatment` (201)                                   |
| `PATCH /api/v1/admin/treatments/:id` | Dentista | `AdminTreatment`; acepta `name`, `description`, `active` |

## Reglas

- Nombre obligatorio, máximo 80 caracteres, único sin distinguir mayúsculas (índice `lower(name)`), 409 si se repite.
- Descripción opcional, máximo 500 caracteres; vacía se guarda como `null`.
- No hay borrado: desactivar (`active: false`) lo oculta del portal y conserva el historial.
- El anticipo **no** pertenece al tratamiento: es único para la clínica (V-06, T-01).
- Auditoría: `treatment_created` y `treatment_updated` (con antes y después), en la misma transacción.

## Pruebas

- Integración: `apps/api/test/integration/treatments.int-spec.ts`.
- E2E: `apps/web/e2e/treatments.e2e.ts`.

Guía para copiar este módulo: `docs/GUIA-MOLDE-MODULO.md`.
