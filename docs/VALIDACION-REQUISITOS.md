# Validación y trazabilidad — Renovando Sonrisas v4.2

**Estado:** BORRADOR. Requiere visto bueno del dentista/cliente.
**Contrato de fuentes:** el documento v4.2 define el alcance funcional; el `BRIEF-SISTEMA-DENTAL.md` define la base técnica y el proceso. La demo Lúmina es material de referencia, no funcionalidad existente ni fuente de reglas de negocio.

## 1. Resumen de requisitos del cliente

- Actores: **un dentista** (único usuario autenticado interno) y **paciente sin cuenta**.
- Consultas de **90 minutos**, comienzos cada **30 minutos** (S-03 pendiente de validar); los intervalos de atención se configuran por fecha.
- Anticipo **10–20 Bs** por tratamiento, mostrado mediante **QR externo**; el paciente entrega **número de comprobante** y el dentista lo confirma manualmente.
- El horario solo se bloquea después de confirmar el pago, nunca al crear la solicitud ni al reportar el comprobante.
- Estados permitidos: `por_pagar` → `pago_en_revision` → `confirmada` → `completada`; `por_pagar`, `pago_en_revision`, `confirmada` pueden pasar a `cancelada` mediante los flujos autorizados. Los terminales son `completada` y `cancelada`.
- Historial inmutable por versiones: anamnesis, odontograma, índice dental y diagnóstico; únicamente el dentista lo escribe.
- Solo enviar correo al **eliminar/cancelar** una consulta (hasta 3 reintentos); no enviar al confirmar ni mover, salvo posterior aprobación.
- Chat web por reglas fijas, sin diagnóstico y sin IA; WhatsApp visible como medio de contacto, **sin integración API**.
- Se excluyen móvil nativo, recepcionista, varios odontólogos, cobro automatizado, descuentos y certificados no aprobados.

## 2. Trazabilidad funcional RF → módulo → caso de uso → prueba inicial

| RF | Módulo | CU | Validación esencial |
|---|---|---|---|
| RF-01 | Tratamientos / portal | CU-01 | Solo tratamientos activos visibles |
| RF-02 | Disponibilidad | CU-01, CU-10 | Inicio cada 30 min; intervalo completo de 90 min sin choque confirmado |
| RF-03 | Agendamiento | CU-01 | Nombre, celular y email válidos |
| RF-04 | Agendamiento | CU-01 | Crear `por_pagar`, horario no bloqueado, vincular paciente |
| RF-05 | Agendamiento | CU-01 | Máximo 3 consultas pendientes/paciente |
| RF-06 | Agenda / expiración | CU-01, CU-02 | `por_pagar` vencidas pasan a `cancelada` |
| RF-07 | Pago QR / comprobante | CU-02 | Referencia única; cambia a `pago_en_revision` |
| RF-08 | Consultas del paciente | CU-03 | Mostrar solo citas propias; nunca historia clínica |
| RF-09 | Seguridad pública | CU-03 | 5 fallos en 10 min ⇒ bloqueo 15 min |
| RF-10 | Chat web | CU-04 | Respuesta por reglas fijas, sin IA |
| RF-11 | Chat web | CU-04 | Urgencia ⇒ mensaje de emergencia y WhatsApp |
| RF-12 | Chat web | CU-04 | Sin regla ⇒ respuesta de fallback y WhatsApp |
| RF-13 | Autenticación | CU-05 | 5 fallos ⇒ 15 min, inactividad 30 min |
| RF-14 | Horarios | CU-06 | CRUD intervalos por fecha, respetar confirmadas |
| RF-15 | Tratamientos | CU-07 | Alta/edición/activar/desactivar; anticipo 10–20 Bs |
| RF-16 | Agenda | CU-08 | Día/semana + filtros y detalle |
| RF-17 | Confirmación del pago | CU-09 | Bloqueo transaccional + autor/fecha |
| RF-18 | Confirmación del pago | CU-09 | Nunca dos confirmadas solapadas, sin botón rechazar |
| RF-19 | Reprogramar | CU-10 | Disponibilidad y traza antes/después |
| RF-20 | Cancelar | CU-11 | Cancelación lógica, motivo, devolución y liberar horario |
| RF-21 | Correo | CU-11 | Solo cancelación, registrar hasta 3 reintentos |
| RF-22 | Pacientes | CU-12 | Nombre normalizado + celular únicos; advertir celular compartido |
| RF-23 | Pacientes | CU-13 | Buscar nombre/celular y abrir ficha completa |
| RF-24 | Historia clínica | CU-14 | Versión inmutable y consecutiva con autor/fecha |
| RF-25 | Autorización clínica | CU-14 | Escritura exclusiva del dentista |
| RF-26 | Cierre clínico | CU-15 | Solo confirmada iniciada, diagnóstico y costo obligatorios |
| RF-27 | Auditoría | CU-09,10,11,12 | Registrar quién/cuándo, valores antes/después |
| RF-28 | Portal | CU-04 | WhatsApp visible, sin integración |

## 3. Trazabilidad RNF → verificación

| RNF | Criterio del documento | Evidencia objetivo |
|---|---|---|
| RNF-01 | Agendamiento ≤3 s al p95 en 4G (propuesto) | Prueba de rendimiento con perfil 4G |
| RNF-02 | Búsqueda ≤2 s y ficha ≤10 s (propuesto) | Prueba con datos representativos |
| RNF-03 | 2.000 pacientes, 15 consultas/día, 10 concurrentes (propuesto) | Prueba de carga |
| RNF-04 | 99 % mensual (propuesto) | Monitoreo y fórmula acordada |
| RNF-05 | Hash seguro + HTTPS (definido) | Revisión configuración y seguridad |
| RNF-06 | Privacidad clínica y consultas propias (definido) | API authorization / IDOR / error messages |
| RNF-07 | No solape confirmado incluso concurrente (definido) | Prueba de dos confirmaciones simultáneas contra BD real |
| RNF-08 | Auditoría inmutable ≥2 años (propuesto) | Restricciones de escritura y política de retención |
| RNF-09 | Español, móvil ≥360 px, reserva <3 min (propuesto) | E2E + evaluación de usabilidad |
| RNF-10 | Backup diario, retención 30 días, restauración ≤4 h (propuesto) | Restauración controlada y evidencia |
| RNF-11 | America/La_Paz, dd/mm/aaaa, 24 horas (definido) | Tests de zonas horarias y formato |
| RNF-12 | Correo cancelación ≤5 min (propuesto) | Prueba de outbox y reintentos |
| RNF-13 | 2 versiones más recientes Chrome/Edge/Firefox/Safari (propuesto) | Matriz cross-browser |
| RNF-14 | Datos clínicos confidenciales (definido) | Threat model, autorización y HTTPS |

## 4. Diferencias entre el Word v4.2 y la demo

| Aspecto | Word v4.2 | Demo Lúmina | Tratamiento recomendado |
|---|---|---|---|
| Dentistas | Uno solo | Preferencia de especialidad | Eliminar paso o simplificarlo, no crear roles extra |
| Duración | Todos 90 minutos | 30–90 según tratamiento | Reemplazar por 90 min para todos |
| Catálogo | 7 tratamientos de Renovando Sonrisas | Catálogo y motivos ficticios diferentes | Semilla del Word; no copiar lista de la demo |
| Disponibilidad | Horarios configurables por fecha + cupos de 30 min | Reglas deterministas sin backend | API real + verificación transaccional |
| Reserva | `por_pagar`, luego QR y comprobante, luego dentista confirma | Termina en solicitud no persistida | Nueva secuencia y persistencia real |
| Mismo día | Fecha actual o posterior | Solo fechas posteriores | Ajustar al Word y validar hora no pasada |
| Correo | Obligatorio al agendar | Campo no validado como obligatorio | Agregar validación servidor y cliente |
| Contacto | Nombre/celular; consulta de citas | Solo formulario de solicitud | Crear recuperación segura sin cuentas |
| Marca | Renovando Sonrisas | Lúmina ficticia | Reutilizar estilo; sustituir identidad y fotos aprobadas |

## 5. Riesgos y lagunas funcionales detectadas

1. **Privacidad del paciente:** consultar citas únicamente con nombre y celular (CU-03) permite que alguien que conozca ambos datos vea información de otro. Aun con rate limit, requiere decisión explícita de seguridad (OTP/enlace de un solo uso u otro control); si se introduce, documentar cambio de alcance.
2. **Competencia por el mismo horario:** se permiten varios pagos en revisión sobre una misma franja. Solo la confirmación transaccional reserva. Documentar comunicación y devolución manual a los perdedores (S-07).
3. **Pago en revisión fuera de fecha:** el vencimiento automático solo está prescrito para `por_pagar` (RF-06). Definir qué ocurre con `pago_en_revision` pasado o `confirmada` no atendida.
4. **Citas completadas vs choque:** RNF-07 habla solo de `confirmada`. Aclarar si `completada` también debe seguir ocupando históricamente su franja, para evitar doble registro en citas ya atendidas.
5. **Correo vs datos opcionales:** CU-01 requiere correo; CU-12 lo considera opcional. Definir claramente cuándo es indispensable.
6. **Definiciones odontológicas:** FDI y CPO-D son S-14; estados odontograma y piezas temporales siguen sin validación.
7. **Normativa:** validar con asesor local el tratamiento/retención de datos de salud. El documento no define plazo legal; no inventarlo.
8. **Origen del repositorio:** el brief exige GitHub mirror privado y Forgejo canónico, pero se observó GitHub público con rama main; Forgejo no fue verificado.
9. **Sin aplicación implementada:** la carpeta `docs/referencia/lumina-dental/` es material de referencia, no un monorepo ejecutable autónomo.
10. **Migración:** 400–500 fichas en cuadernos; volumen a digitalizar y calidad de datos por determinar.

## 6. Diez preguntas de validación al cliente / propietario

1. ¿Se aprueba la identificación solo con nombre+celular para consultar citas o se exige verificación adicional (p. ej., OTP)? ¿Cómo manejar menores y celulares compartidos?
2. ¿El correo sigue siendo obligatorio en cada cita pública? ¿Cómo se cancela una cita de pacientes cargados por el dentista sin correo?
3. ¿Se confirman los inicios cada 30 minutos, el tiempo fijo de 90 minutos y la posibilidad de agendar el mismo día?
4. ¿El dentista fija un anticipo de 10–20 Bs por tratamiento y proporcionará un QR vigente de su cuenta? ¿Se verifica solo número de comprobante?
5. ¿Qué hacer si vence una consulta con pago «en revisión» o una confirmada sin asistencia? ¿Se añade un estado «no asistió» o se mantiene el modelo de cinco estados?
6. ¿Una cita completada conserva exclusividad de su intervalo horario en el historial?
7. ¿Confirma FDI y CPO-D, tipos de pieza (permanente/temporal) y catálogo de estados del odontograma?
8. ¿Cuántas de las 400–500 historias en papel se migrarán, y quién revisará exactitud y duplicados?
9. ¿Aprueba los RNF propuestos (tiempos, capacidad, disponibilidad, respaldos, auditoría, navegadores) y la política de retención clínica con asesoría local?
10. ¿Se confirma sistema web para una sola clínica, nombre «Renovando Sonrisas», PostgreSQL propuesto y esquema de repositorios Forgejo canónico / GitHub mirror **privado**?

Hasta responderlas, las decisiones correspondientes se marcan `PENDIENTE` y no se consolidan como contrato.
