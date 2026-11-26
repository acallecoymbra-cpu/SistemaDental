# Módulo `appointments` (T-06)

Citas. Por ahora solo la reserva pública; la agenda del dentista (T-10) y los cambios de estado (T-11 a T-13) se agregan aquí.

## Ruta pública

- `POST /api/v1/appointments` (sin sesión, con `Origin` permitido): `{ treatmentId, startsAt, patient: { fullName, phone, email, birthDate?, guardianPhone? } }` → 201 `PublicBooking` (`id`, `startsAt`, `endsAt`, `holdExpiresAt`, `treatmentName`, `depositCents`).

## Reglas (todo en una transacción)

1. Tratamiento activo (404 si no).
2. `startsAt` debe ser una franja de las que ofrece `GET /availability/slots` (409 si no, incluido hoy y el pasado).
3. Paciente: se reconoce por nombre normalizado + celular y se bloquea su fila; si no existe se crea con origen `web` (entonces `birthDate` es obligatoria, y un menor exige `guardianPhone`). A un paciente existente no se le cambian datos desde el portal (solo se completa el correo si faltaba).
4. Máximo 3 pendientes por paciente (`por_pagar` con reserva vigente) → 409.
5. Se cancelan las `por_pagar` vencidas que chocan con la franja (`appointment_hold_expired`, actor sistema) y se inserta con `hold_expires_at = now() + 8 min` y el anticipo vigente como copia (`deposit_cents`). Si dos reservan la misma franja a la vez, la restricción de exclusión deja pasar a uno y el otro recibe 409.

- Si algo falla, no queda ni la cita ni el paciente nuevo. Una carrera al crear el mismo paciente se reintenta una vez.
- Auditoría `appointment_created` (actor anónimo): solo origen, estado y tratamiento, sin datos de contacto.

## Vencimiento automático (T-08)

- `HoldExpirationJob`: cada minuto cancela las `por_pagar` con plazo vencido (`appointment_hold_expired`, actor sistema). Un temporizador dentro de la API, sin dependencias nuevas.
- Segura con varias instancias (candado de PostgreSQL), idempotente, y un fallo se registra sin detener las siguientes pasadas.
- `HOLD_EXPIRATION_JOB=false` la apaga; en pruebas (`NODE_ENV=test`) no arranca sola.
- La regla vive en un solo lugar, `AppointmentHoldsService.releaseExpired`, que también usa la reserva pública.

## Agenda del dentista (T-10)

- `GET /api/v1/admin/appointments?from=&to=&status=&patient=` (requiere sesión, solo lectura): consultas entre dos fechas `AAAA-MM-DD` de La Paz, ambas inclusive (por defecto hoy). Máximo 62 días; fecha, rango o estado inválidos → 400.
- `patient` busca por nombre normalizado; solo busca por celular (propio o del apoderado) si el texto parece un teléfono. Orden por hora de inicio, tope de 500.
- `GET /api/v1/admin/appointments/:id` → detalle (404 si no existe). Cada ítem es `AdminAppointment` (contrato `admin-appointments.ts`).
- `paymentProof` trae el comprobante enviado (número, fecha y si ya fue confirmado) o `null`.
- Web: `/panel/agenda` (vista Día/Semana, filtros de estado y paciente, detalle desplegable).

## Comprobante de pago (T-07)

- `POST /api/v1/appointments/:id/payment-proof` (sin sesión): `{ receiptNumber }` → 201 `{ appointmentId, submittedAt }`. El `id` de la reserva (UUID v4, solo lo recibe quien reservó) hace de llave.
- Formato: letras, números y guiones, 4 a 30 caracteres; se guarda en mayúsculas. La cita sigue `por_pagar` hasta que la doctora confirme (T-11).
- 409 si: el número ya existe en cualquier otra cita (restricción única en la base), la cita ya tiene comprobante, ya no está pendiente, o el plazo de 8 minutos pasó / la reserva fue cancelada por vencimiento (mensaje que indica escribir por WhatsApp). 404 genérico si el id no existe.
- Se bloquea la fila de la cita: si el vencimiento y el comprobante coinciden, gana uno solo.
- Una `por_pagar` con comprobante **no vence**, sigue ocupando su franja (`listSlots`) y cuenta para el máximo de 3 pendientes.
- La reserva (`PublicBooking`) devuelve `paymentQrRef` y `whatsappPhone` para mostrar el QR y el botón de ayuda. La imagen del QR no se guarda en el repositorio: es un enlace o ruta.
- Auditoría `payment_proof_submitted` (actor anónimo), sin el número de comprobante.

## Mis consultas (T-09)

- `POST /api/v1/appointments/lookup` (sin sesión): `{ fullName, phone }` → 200 con la lista `PublicAppointmentSummary` (`startsAt`, `endsAt`, `treatmentName`, `status`, `depositCents`, `paymentReceived`). Nada clínico, sin ids y sin datos de otras personas.
- Identidad: nombre normalizado (sin tildes ni mayúsculas) + celular del paciente **o** de su apoderado (un menor se consulta con su nombre y el celular del apoderado). Máx. 50 consultas, las más recientes primero.
- Un solo mensaje 404 para «nombre inexistente», «celular equivocado» y «sin consultas»: no revela qué falló.
- Límite (`public_lookup_attempt`): 5 intentos sin resultado en 10 minutos desde el mismo origen → 429 por 15 minutos (no se consulta nada mientras dure, y no se extiende). El origen es un hash de la IP (`AUDIT_IP_SALT`), nunca la IP; un candado por origen impide saltarse el límite con peticiones simultáneas. Los aciertos no cuentan. Las filas de más de 24 h se borran al registrar nuevos intentos.
- El intento fallido se confirma **antes** de lanzar el 404 (si el error se lanzara dentro de la transacción, se desharía el registro).
- Auditoría `public_lookup_blocked` (actor anónimo) cuando un origen se bloquea, sin datos personales.
- Los errores de formato (400) no cuentan como intento.
- Detrás de un proxy, `TRUST_PROXY` debe estar bien configurado: si no, todos los visitantes compartirían un mismo origen.

## Confirmar pago (T-11)

- `POST /api/v1/admin/appointments/:id/confirm-payment` (requiere sesión) → 200 `AdminAppointment`. `por_pagar` con comprobante → `confirmada`; se limpia el plazo de reserva y `payment_proof` guarda `confirmed_at` y `confirmed_by` (quién y cuándo). Auditoría `appointment_payment_confirmed` (actor dentista, antes/después del estado).
- 409 si no está `por_pagar` o si aún no tiene comprobante. Se puede confirmar aunque el plazo de 8 minutos haya pasado (tiene comprobante).
- **No existe rechazar** (V-17): no hay ruta ni botón. Si algo está mal, la doctora coordina por WhatsApp y cancela (T-13).
- Concurrencia: la fila de la cita se bloquea; con confirmaciones simultáneas gana una y las demás reciben el mismo resultado (200), sin duplicar la auditoría.
- `GET /admin/appointments?review=true`: solo las `por_pagar` con comprobante sin confirmar. En la web, la casilla «Solo por confirmar» mira los próximos 2 meses.

## Cancelar y avisar (T-13)

- `POST /api/v1/admin/appointments/:id/cancel` `{ reason }` (requiere sesión) → 200 `{ appointment, notice }`. Solo desde `por_pagar` o `confirmada` (409 en otro caso). El motivo es obligatorio (máx. 500) y es interno: **no se envía al paciente** ni va a la auditoría.
- Guarda motivo, quién y cuándo, y `refunded = 'no'` (el anticipo no se devuelve, V-15). La franja queda libre (la cancelada sale de la restricción de superposición). Auditoría `appointment_canceled`.
- Aviso por correo con **outbox** (`email_notification`): si el paciente tiene correo, el aviso se guarda en la MISMA transacción que la cancelación (`notice: 'queued'`); si no tiene, `notice: 'no_email'` y la pantalla recuerda avisar por WhatsApp. Una cancelación no se deshace por un fallo de correo.
- `EmailOutboxJob` (cada 30 s; `EMAIL_OUTBOX_JOB=false` lo apaga; en `NODE_ENV=test` no arranca solo) → `EmailOutboxService.processDue`: hasta **3 intentos en total** (el primero cuenta), esperando 1 y 5 minutos entre ellos; `FOR UPDATE SKIP LOCKED` (un aviso lo toma un solo proceso); idempotente. De cada fallo solo se guarda un **código** (`last_error_code`), nunca el mensaje del proveedor. El correo no incluye el motivo.
- `AdminAppointment.cancelNotification` (solo en canceladas): `pending | sent | failed | none`.
- **Proveedor de correo: pendiente de decidir.** `Mailer` es un puerto (`src/mail/mailer.ts`). Mientras no se conecte uno real, `UnconfiguredMailer` NO finge enviar: falla con `mail_not_configured` y el aviso queda `failed` en la agenda (la doctora ve «No se pudo enviar el correo» y puede avisar por WhatsApp). Para activar el envío hay que implementar `Mailer` con el proveedor elegido (por ejemplo SMTP) y registrarlo en `AppointmentsModule`.

## Pendiente para otras tareas


## Reprogramar y «no asistió» (T-12)

- `POST admin/appointments/:id/reschedule` `{ startsAt }`: solo `por_pagar` o `confirmada`. La nueva hora debe ser una franja de los horarios publicados (grilla de 45 min), futura y distinta de la actual; una reserva vencida sin comprobante en esa franja se libera; si sigue ocupada, 409 (también ante carreras: lo decide la restricción de superposición, 23P01). Estado y comprobante no cambian. Auditoría `appointment_rescheduled` con antes/después (`startsAt`, `endsAt`).
- `GET admin/availability-slots?date=` (panel): igual que la pública, pero incluye las franjas de hoy que aún no empezaron.
- `POST admin/appointments/:id/no-show`: solo desde `confirmada` y con la hora de inicio ya pasada. Estado final, `refunded = 'no'` (anticipo retenido). Auditoría `appointment_no_show`.
- Pruebas: `test/integration/reschedule-no-show.int-spec.ts`, `e2e/reschedule.e2e.ts`.

## Cerrar consulta (T-17)

- `POST admin/appointments/:id/complete` `{ diagnosis, costCents }`: solo desde `confirmada` y con la hora de inicio ya pasada (409 si no). Diagnóstico obligatorio (hasta 2000), costo entero ≥ 0 (centavos de Bs). Pasa a `completada`, estado final: ni la API ni el disparador de la base permiten cambiarla después.
- Auditoría `appointment_completed` con el costo, sin copiar el diagnóstico.
- `AdminAppointment` ahora trae `diagnosis` y `costCents`; la ficha del paciente ya los mostraba.
- Pruebas: `test/integration/complete-appointment.int-spec.ts`, `e2e/reschedule.e2e.ts` (bloque «cerrar consulta»).
