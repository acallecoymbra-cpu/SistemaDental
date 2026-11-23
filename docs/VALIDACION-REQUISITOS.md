# Validación y trazabilidad — Renovando Sonrisas v4.2

**Estado:** VALIDACIÓN PARCIAL (2026-11-20). El cliente respondió en tres rondas (§6, §6.2, §6.3); lo que no queda ACEPTADO está en §7.
**Contrato de fuentes:** el documento v4.2 define el alcance funcional, **modificado** por las respuestas ACEPTADAS de §6, que prevalecen sobre el Word donde lo contradicen. El `BRIEF-SISTEMA-DENTAL.md` define la base técnica y el proceso. La demo Lúmina es material de referencia, no funcionalidad existente ni fuente de reglas de negocio.

## 1. Resumen de requisitos del cliente (vigente tras §6)

- Actores: **un dentista** (único usuario autenticado interno) y **paciente sin cuenta**, identificado con nombre y celular sin código de verificación (V-01).
- Inicios de consulta cada **45 minutos** (V-05); cada consulta dura **30 a 45 min** y el sistema reserva una franja fija de **45 min** (V-20). Intervalos de atención configurables por fecha.
- Sin citas el mismo día: la fecha más cercana es el **día siguiente** (V-05).
- Precio de consulta **30 Bs**; anticipo **único** para todas las consultas, configurable entre **10 y 20 Bs**, pagado por **QR** que el dentista entrega y actualiza (V-06). Saldo en clínica: PROPUESTA.
- El paciente entrega **número de comprobante**; el dentista lo compara con su cuenta y confirma manualmente (V-07).
- **Reserva tipo butaca de cine (V-21):** al reservar, el horario queda apartado para ese paciente durante **8 minutos** como máximo para pagar y entregar el comprobante; nadie más puede reservarlo. Sin comprobante a los 8 min, la reserva se cancela y el horario se libera. Con comprobante, el horario sigue apartado hasta que el dentista confirme (V-17). Cambia la regla del Word, que solo bloqueaba al confirmar.
- **Cinco estados** (V-08, V-22): `por_pagar` → `confirmada` → `completada` o `no_asistio`; `por_pagar` y `confirmada` pueden pasar a `cancelada`. Se elimina `pago_en_revision`. Saldo (30 Bs menos el anticipo) se paga en el consultorio el día de la consulta (V-23).
- El anticipo **no se devuelve** al cancelar por pedido del paciente ni por inasistencia (V-04, V-08).
- Historial inmutable por versiones: anamnesis, odontograma, índice dental y diagnóstico; únicamente el dentista lo escribe.
- Correo obligatorio en cada cita pública; solo se envía al **eliminar/cancelar** una consulta (hasta 3 reintentos).
- Chat web por reglas fijas, sin diagnóstico y sin IA; WhatsApp visible como medio de contacto, **sin integración API**. El paciente cancela escribiendo al dentista por WhatsApp (V-04).
- Se excluyen móvil nativo, recepcionista, varios odontólogos, cobro automatizado, descuentos y certificados no aprobados.

## 2. Trazabilidad funcional RF → módulo → caso de uso → prueba inicial

| RF | Módulo | CU | Validación esencial |
|---|---|---|---|
| RF-01 | Tratamientos / portal | CU-01 | Solo tratamientos activos visibles |
| RF-02 | Disponibilidad | CU-01, CU-10 | Inicio cada 45 min; franja de 45 min; desde el día siguiente; oculta franjas con reserva vigente, confirmada, completada o no asistida |
| RF-03 | Agendamiento | CU-01 | Nombre, celular y email válidos; fecha de nacimiento al registrarse; celular de padre/madre si es menor |
| RF-04 | Agendamiento | CU-01 | Crear `por_pagar` que aparta la franja 8 min; una segunda reserva simultánea de la misma franja falla; vincular paciente existente o nuevo |
| RF-05 | Agendamiento | CU-01 | Máximo 3 consultas pendientes/paciente |
| RF-06 | Agenda / expiración | CU-01, CU-02 | `por_pagar` sin comprobante a los 8 min pasan a `cancelada`; con comprobante no vencen (V-17, V-21) |
| RF-07 | Pago QR / comprobante | CU-02 | Referencia única ligada a su consulta; la consulta sigue `por_pagar` |
| RF-08 | Consultas del paciente | CU-03 | Mostrar solo citas propias; nunca historia clínica |
| RF-09 | Seguridad pública | CU-03 | 5 fallos en 10 min ⇒ bloqueo 15 min |
| RF-10 | Chat web | CU-04 | Respuesta por reglas fijas, sin IA |
| RF-11 | Chat web | CU-04 | Urgencia ⇒ mensaje de emergencia y WhatsApp |
| RF-12 | Chat web | CU-04 | Sin regla ⇒ respuesta de fallback y WhatsApp |
| RF-13 | Autenticación | CU-05 | 5 fallos ⇒ 15 min, inactividad 30 min |
| RF-14 | Horarios | CU-06 | CRUD intervalos por fecha, respetar confirmadas |
| RF-15 | Tratamientos / configuración | CU-07 | Alta/edición/activar/desactivar; anticipo único global 10–20 Bs; QR vigente |
| RF-16 | Agenda | CU-08 | Día/semana + filtros y detalle |
| RF-17 | Confirmación del pago | CU-09 | `por_pagar` con comprobante → `confirmada`; bloqueo transaccional + autor/fecha |
| RF-18 | Confirmación del pago | CU-09 | Nunca dos confirmadas solapadas, sin botón rechazar |
| RF-19 | Reprogramar | CU-10 | Disponibilidad y traza antes/después |
| RF-20 | Cancelar | CU-11 | Cancelación lógica, motivo, anticipo no devuelto, liberar horario |
| RF-21 | Correo | CU-11 | Solo cancelación, registrar hasta 3 reintentos; sin correo ⇒ aviso al dentista (PROPUESTA) |
| RF-22 | Pacientes | CU-12 | Nombre normalizado + celular únicos; mismo celular y otro nombre = otro paciente |
| RF-23 | Pacientes | CU-13 | Buscar nombre/celular y abrir ficha completa |
| RF-24 | Historia clínica | CU-14 | Versión inmutable y consecutiva con autor/fecha |
| RF-25 | Autorización clínica | CU-14 | Escritura exclusiva del dentista |
| RF-26 | Cierre clínico | CU-15 | Solo confirmada iniciada, diagnóstico y costo obligatorios; completada queda de solo lectura |
| RF-27 | Auditoría | CU-09,10,11,12 | Registrar quién/cuándo, valores antes/después |
| RF-28 | Portal | CU-04 | WhatsApp visible, sin integración |

## 3. Trazabilidad RNF → verificación

Todos los valores de esta tabla quedaron **aprobados por el cliente** el 2026-11-20 (V-12). Aprobados no significa cumplidos: cada uno requiere evidencia medida.

| RNF | Criterio | Evidencia objetivo |
|---|---|---|
| RNF-01 | Agendamiento ≤3 s al p95 en 4G | Prueba de rendimiento con perfil 4G |
| RNF-02 | Búsqueda ≤2 s y ficha ≤10 s | Prueba con datos representativos |
| RNF-03 | 2.000 pacientes, 15 consultas/día, 10 concurrentes | Prueba de carga |
| RNF-04 | 99 % mensual | Monitoreo y fórmula acordada |
| RNF-05 | Hash seguro + HTTPS | Revisión configuración y seguridad |
| RNF-06 | Privacidad clínica y consultas propias | API authorization / IDOR / error messages |
| RNF-07 | No solape confirmado incluso concurrente | Prueba de dos confirmaciones simultáneas contra BD real |
| RNF-08 | Auditoría inmutable ≥2 años | Restricciones de escritura y política de retención |
| RNF-09 | Español, móvil ≥360 px, reserva <3 min | E2E + evaluación de usabilidad |
| RNF-10 | Backup diario, retención 30 días, restauración ≤4 h | Restauración controlada y evidencia |
| RNF-11 | America/La_Paz, dd/mm/aaaa, 24 horas | Tests de zonas horarias y formato |
| RNF-12 | Correo cancelación ≤5 min | Prueba de outbox y reintentos |
| RNF-13 | 2 versiones más recientes Chrome/Edge/Firefox/Safari | Matriz cross-browser |
| RNF-14 | Datos clínicos confidenciales; retención clínica con asesoría local | Threat model, autorización, HTTPS y política de retención documentada |

## 4. Diferencias entre requisitos vigentes y la demo

| Aspecto | Requisito vigente | Demo Lúmina | Tratamiento recomendado |
|---|---|---|---|
| Dentistas | Uno solo | Preferencia de especialidad | Eliminar paso o simplificarlo, no crear roles extra |
| Duración | Franja fija de 45 min (V-20) | 30–90 según tratamiento | Franja uniforme de 45 min para todos |
| Catálogo | 7 tratamientos de Renovando Sonrisas | Catálogo y motivos ficticios diferentes | Semilla del Word; no copiar lista de la demo |
| Disponibilidad | Intervalos por fecha + inicios cada 45 min | Reglas deterministas sin backend | API real + verificación transaccional |
| Reserva | `por_pagar` + QR y comprobante; el dentista confirma | Termina en solicitud no persistida | Nueva secuencia y persistencia real |
| Mismo día | No; desde el día siguiente (V-05, cambia el Word) | Solo fechas posteriores | Coincide con la demo; validar en servidor con huso La Paz |
| Correo | Obligatorio al agendar | Campo no validado como obligatorio | Agregar validación servidor y cliente |
| Contacto | Nombre/celular; registro previo o nuevo; consulta de citas | Solo formulario de solicitud | Paso «¿ya estás registrado?» + recuperación sin cuentas |
| Marca | Renovando Sonrisas | Lúmina ficticia | Reutilizar estilo; sustituir identidad y fotos aprobadas |

## 5. Riesgos y lagunas funcionales (actualizado tras §6)

1. **Privacidad del paciente (riesgo aceptado):** el cliente aprobó nombre+celular sin código (V-01). Quien conozca ambos datos puede ver las consultas de otro, nunca su historia clínica. Mitigación vigente: rate limit RF-09, respuestas mínimas y errores genéricos.
2. **Competencia por el mismo horario (resuelto, V-21):** la franja se aparta al reservar, 8 min como máximo sin comprobante. Ya no pueden existir dos reservas vigentes sobre la misma franja, y la restricción de BD se aplica al crear la reserva, no solo al confirmar. Riesgo residual: 8 min puede ser poco para pagar por QR y escribir el comprobante; si el plazo vence, el paciente debe reservar de nuevo. Si ya pagó, el comprobante tardío se resuelve por WhatsApp (el anticipo nunca se devuelve, V-15).
3. **Vencimiento con comprobante entregado (resuelto, V-17):** una `por_pagar` con comprobante **no** se cancela sola; el job de RF-06 solo cancela las que no tienen comprobante. La respuesta del cliente dice que «la funcionalidad va a detectar si el pago se realizó»: el sistema **no** detecta pagos (no hay integración bancaria, V-07); la verificación sigue siendo manual del dentista. Conviene aclarárselo.
4. **Duración de consulta (resuelto, V-20):** franja fija de 45 min, igual a la grilla de inicios. Si una consulta real dura menos, el tiempo sobrante no se reasigna.
5. **Menores de edad (resuelto, V-18):** el menor se marca con una etiqueta y se identifica con el celular de su apoderado, que es el que sirve para consultar sus citas.
6. **Inasistencia (resuelto, V-22):** se agrega `no_asistio`, terminal, que registra el anticipo retenido.
7. **Definiciones odontológicas:** FDI y CPO-D aceptados (V-19). Falta la lista concreta de estados de pieza que el consultorio ya usa en su registro.
8. **Normativa:** retención clínica aprobada con asesoría local (V-12), pero aún sin plazo concreto definido; no inventarlo.
9. **Repositorio (resuelto):** el cliente pidió GitHub como **espejo privado** (V-13); el propietario ratificó el 2026-11-20 que sigue **público** (ADR-008). Público **por el momento**; el cliente está informado. Todo lo versionado es público: nunca datos de pacientes, archivos clínicos, secretos ni el Word.
10. **Migración:** se migran fichas de los últimos 6 meses (V-11); el resto se carga gradualmente. Responsable de exactitud y duplicados: PROPUESTA (el dentista al cargar cada ficha).
11. **Sin aplicación implementada:** `docs/referencia/lumina-dental/` es material de referencia, no un monorepo ejecutable autónomo.

## 6. Respuestas del cliente (2026-11-20)

**Procedencia:** documento «Renovando Sonrisas: validación con el cliente» (20/11/2026), entregado por el propietario en sesión de Claude Code el 2026-11-20. Estados: **ACEPTADA** (respuesta firme del cliente), **PROPUESTA** (sugerida, por confirmar), **PENDIENTE** (sin respuesta).

| # | Pregunta | Respuesta | Estado | Impacto |
|---|---|---|---|---|
| V-01 | ¿Identificar solo con nombre y celular? | Sí, sin código de verificación. Solo ve sus consultas, nunca historial clínico. | ACEPTADA | ADR-003 cerrada sin OTP; riesgo 1 aceptado |
| V-02 | ¿Menores y celulares compartidos? | Se pregunta si ya está registrado: si sí, se usan sus datos; si no, completa datos con fecha de nacimiento. Menor ⇒ celular de padre/madre obligatorio. Mismo celular con distinto nombre = pacientes distintos. | ACEPTADA (detalle del celular del menor por definir, riesgo 5) | `patient.birth_date`, `guardian_phone`; flujo de registro previo |
| V-03 | ¿Correo obligatorio en cada cita pública? | Sí; es el medio para avisar si el dentista elimina la consulta. | ACEPTADA | Sin cambio |
| V-04 | ¿Cancelación de paciente sin correo? | El paciente pide por WhatsApp; el dentista cancela. Anticipo no se devuelve. | ACEPTADA | Sin cancelación pública; RF-20 sin devolución |
| V-04b | Sin correo, el sistema recuerda al dentista avisar por WhatsApp. | — | PROPUESTA | RF-21 |
| V-05 | ¿Inicios cada 30 min, duración 90, mismo día? | Inicios cada 45 min; sin mismo día (desde el día siguiente). | ACEPTADA | RF-02, TASK-203 |
| V-05b | Duración de consulta: ¿45 o 90 min? | Se entiende 45, sin confirmar. | PENDIENTE | Bloquea TASK-203 y constraint de solapes |
| V-06 | ¿Anticipo 10–20 Bs por tratamiento y QR? | Consulta 30 Bs; anticipo único 10–20 Bs para todas, no por tratamiento; QR entregado y actualizado por el dentista. | ACEPTADA | `clinic_settings` en lugar de `treatment.deposit_cents` |
| V-06b | Saldo pagado en la clínica. | — | PROPUESTA | Sin cobro en sistema |
| V-07 | ¿Verificar solo con número de comprobante? | Sí; el dentista compara con su cuenta y confirma. Comprobante ligado a su consulta. | ACEPTADA | RF-07/17 |
| V-07b | Rechazar número ya usado en otra consulta. | — | PROPUESTA (ya previsto como `UNIQUE`) | `payment_proof.receipt_number UNIQUE` |
| V-08 | ¿Vencidos, inasistencia, estado «no asistió»? | Anticipo no se devuelve por inasistencia. Se elimina `pago_en_revision`; cuatro estados: por pagar, confirmada, completada, cancelada. | ACEPTADA | ADR-005, enum, PLAN §4.1 |
| V-08b | Estado `no_asistio` para registrar anticipos retenidos. | — | PROPUESTA | Enum de 5 si se aprueba |
| V-09 | ¿Completada sigue ocupando su franja? | Sí, como consulta anterior de solo lectura. | ACEPTADA | Restricción de solapes incluye `completada` |
| V-10 | ¿FDI, CPO-D, tipos de pieza, estados? | Sin respuesta. FDI y CPO-D como supuesto; faltan estados de pieza. | PENDIENTE | TASK-504 bloqueada |
| V-11 | ¿Cuántas historias se migran y quién revisa? | Últimos 6 meses; el resto conforme se avance. | ACEPTADA | Plan de migración |
| V-11b | Revisión de exactitud/duplicados por el dentista al cargar cada ficha. | — | PROPUESTA | |
| V-12 | ¿RNF y retención clínica con asesoría local? | Sí, todos. | ACEPTADA | §3, ADR-010 |
| V-13 | ¿Web una clínica, «Renovando Sonrisas», PostgreSQL, Forgejo principal + GitHub espejo privado? | Sí, todo. | ACEPTADA salvo visibilidad: GitHub sigue público por decisión del propietario (riesgo 9) | ADR-001, ADR-004, ADR-008 |

### 6.2 Segunda ronda (2026-11-20, WhatsApp)

**Procedencia:** conversación de WhatsApp con el cliente, pegada por el propietario en sesión de Claude Code el 2026-11-23. Respuestas a las preguntas abiertas de la primera ronda.

| # | Pregunta | Respuesta | Estado | Impacto |
|---|---|---|---|---|
| V-14 | ¿Se agrega el estado `no_asistio`? | Se podría agregar, pero el cliente tiene que consultarlo. | PENDIENTE | V-08b sigue abierta |
| V-15 | ¿Se devuelve el anticipo en algún caso? | El anticipo no tiene devolución. Dudas o consultas del paciente, por el WhatsApp del consultorio. | ACEPTADA | `refunded` siempre `no`; sin flujo de devolución |
| V-06b / V-04b | ¿Saldo en clínica? ¿Aviso al dentista sin correo? | Sin respuesta explícita. | PROPUESTA | Sin cambio |
| V-16 | Dos anticipos por el mismo horario | «No sería posible»: si ya hay una cita reservada, el paciente no puede reservar encima. Si el sistema fallara, se vería en el horario y se habla con ambos por chat. | CONFLICTO con ADR-005 (riesgo 2) | Definir si `por_pagar` oculta la franja |
| V-17 | ¿Se cancela sola una cita con comprobante no confirmado? | No se cancela; el dentista asume que ya pagó. | ACEPTADA (ver aclaración del riesgo 3) | Job RF-06 excluye `por_pagar` con comprobante |
| V-18 | Celular para consultar citas de un menor | El celular de su apoderado; los menores llevan una etiqueta para comprobar ese número. | ACEPTADA | `patient.is_minor`; lookup por `guardian_phone` |
| V-19 | FDI, CPO-D y estados de pieza | El consultorio tiene su sistema de registro (nomenclatura y estado de pieza) y eligió esos dos sistemas (FDI y CPO-D). | ACEPTADA (FDI/CPO-D); lista de estados PENDIENTE | ADR-009; TASK-504 sigue bloqueada |

### 6.3 Tercera ronda (registrada 2026-11-23, WhatsApp)

**Procedencia:** respuestas del cliente por WhatsApp al mensaje con 6 puntos, pegadas por el propietario en sesión de Claude Code el 2026-11-23.

| # | Pregunta | Respuesta | Estado | Impacto |
|---|---|---|---|---|
| V-20 | ¿La consulta dura 45 o 90 min? | Entre 30 y 45 minutos. | ACEPTADA (franja fija de 45 min, interpretación) | Cierra V-05b; desbloquea TASK-203 |
| V-21 | ¿Una reserva sin pagar oculta el horario? ¿Por cuánto tiempo? | Para reservar se paga el anticipo; confirmado el pago, el horario deja de estar disponible y otro que intente pagarlo al mismo tiempo no podrá. «Como reservar butacas en el cine», máximo 8 minutos. | ACEPTADA | Cierra V-16; `por_pagar` aparta la franja 8 min; supera la regla del Word |
| V-22 | ¿Se agrega `no_asistio`? | Sí. | ACEPTADA | Cierra V-14/V-08b; enum de 5 estados |
| V-23 | ¿El saldo se paga en el consultorio? | Sí, el día de la consulta. | ACEPTADA | Cierra V-06b; sin cobro de saldo en sistema |
| V-24 | ¿Aviso al dentista si el paciente no tiene correo? | Sí. | ACEPTADA | Cierra V-04b; RF-21 |
| V-25 | Lista de estados de pieza | La va a enviar. | PENDIENTE | TASK-504 sigue bloqueada |

## 7. Preguntas que siguen abiertas

1. Lista de estados de pieza del consultorio (V-25). Al recibirla, no versionar la foto: solo la lista de estados.
2. Confirmar con el cliente que el sistema reserva siempre 45 min por consulta, aunque algunas duren 30 (V-20).
3. Confirmar que, si el paciente paga pero no entrega el comprobante en 8 min, la reserva se cae y lo resuelve por WhatsApp con el dentista (V-21, riesgo 2).
4. Propuestas aún sin confirmar: revisión de fichas migradas por el dentista (V-11b).

Hasta responderlas, las decisiones correspondientes se marcan `PENDIENTE` o `PROPUESTA` y no se consolidan como contrato.
