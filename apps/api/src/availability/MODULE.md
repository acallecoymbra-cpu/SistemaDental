# Módulo `availability` — intervalos de atención (T-02)

**Requisitos:** RF-02 y RF-14 (el dentista define su horario de atención por fecha).
**Tabla:** `availability_interval` (migración `CreateAvailabilityIntervals1764400000000`).

## Endpoints

| Método y ruta | Acceso | Respuesta |
|---|---|---|
| `GET /api/v1/admin/availability-intervals` | Dentista | `AvailabilityInterval[]`, por fecha y hora de inicio |
| `POST /api/v1/admin/availability-intervals` | Dentista | `AvailabilityInterval` (201) |
| `PATCH /api/v1/admin/availability-intervals/:id` | Dentista | `AvailabilityInterval`; acepta `serviceDate`, `startsLocal`, `endsLocal` |
| `DELETE /api/v1/admin/availability-intervals/:id` | Dentista | 204 sin cuerpo |

No hay rutas públicas: el paciente verá franjas libres mediante T-03.

## Reglas

- Fecha `AAAA-MM-DD` real; horas `HH:mm` en hora de La Paz.
- Fin posterior al inicio y duración mínima de 45 min (`AVAILABILITY_MIN_MINUTES`) → 400.
- Dos intervalos de la misma fecha no se superponen → 409. Lo decide la base (restricción de exclusión); tocarse en el borde (08:00–12:00 y 12:00–14:00) está permitido.
- En `PATCH` se valida el resultado final (lo guardado + lo enviado).
- Auditoría: `availability_interval_created`, `_updated` (antes y después) y `_deleted` (antes), en la misma transacción.

## Cita confirmada y horarios libres (T-03)
- Al editar, mover o eliminar un intervalo se rechaza con 409 si una cita `confirmada` quedaría fuera (misma transacción). Pruebas en `test/integration/appointments-slots.int-spec.ts`.
- `GET /api/v1/availability/slots?date=AAAA-MM-DD` (público): franjas libres de 45 min dentro de cada intervalo; la última cabe completa. Hoy y el pasado devuelven lista vacía. Ocupan franja las citas `confirmada`, `completada`, `no_asistio` y las `por_pagar` con reserva vigente; una reserva vencida o cancelada libera su franja.
- **Pendiente T-07:** una `por_pagar` vencida pero con comprobante enviado debe seguir ocupando la franja (hoy solo se mira `hold_expires_at`). Extender la consulta de `listSlots` cuando exista `payment_proof`.
