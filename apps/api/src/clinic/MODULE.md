# Módulo `clinic` — configuración de la clínica (T-01)

**Requisitos:** RF-07 y RF-15 (precio, anticipo único, QR de pago, WhatsApp). Decisión V-06.
**Tabla:** `clinic_settings` (migración `CreateClinicSettings1764500000000`), **una sola fila** garantizada por la base.

## Endpoints

| Método y ruta                         | Acceso   | Respuesta                                                                                          |
| ------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `GET /api/v1/clinic`                  | Público  | `PublicClinicInfo`: precio, anticipo y WhatsApp. **Sin el QR**                                     |
| `GET /api/v1/admin/clinic-settings`   | Dentista | `ClinicSettings` completo, con la referencia del QR                                                |
| `PATCH /api/v1/admin/clinic-settings` | Dentista | `ClinicSettings`; acepta `consultationPriceCents`, `depositCents`, `paymentQrRef`, `whatsappPhone` |

No hay POST ni DELETE: la fila la crea la migración.

## Reglas

- Importes en **centavos enteros** (30 Bs = 3000). El anticipo va entre 1000 y 2000 (10 a 20 Bs) y no puede ser mayor que el precio → 400.
- Fila inicial: precio 30 Bs y anticipo **10 Bs** (el mínimo permitido). El dentista lo ajusta.
- `paymentQrRef` es una referencia (enlace o nombre de archivo): **la imagen del QR no se guarda en Git ni en la base**.
- `whatsappPhone`: solo dígitos, `+` opcional al inicio, 7 a 15 dígitos. Texto vacío → `null`.
- Se valida el resultado final de un PATCH (lo guardado + lo enviado). Si nada cambia, no hay auditoría.
- Auditoría: `clinic_settings_updated` (antes y después), en la misma transacción.

## Pruebas

- Integración: `apps/api/test/integration/clinic.int-spec.ts`.
- E2E: `apps/web/e2e/clinic-settings.e2e.ts`.
