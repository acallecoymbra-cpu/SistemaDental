# Módulo `patients` (T-05)

Pacientes de la clínica. Los crea la doctora desde el panel (origen `dentist`); el portal público los creará en T-06 (origen `web`).

## Rutas (`admin/patients`, requieren sesión)

- `GET ?q=` busca por nombre (sin tildes ni mayúsculas) o por celular (también el del apoderado). Máx. 50.
- `GET :id`, `POST`, `PATCH :id`. No hay `DELETE`: los pacientes no se borran.

## Reglas

- Identidad: `normalized_name` + `phone` únicos (409 si se repite). Mismo celular con otro nombre = otro paciente + aviso `SHARED_PHONE_WARNING`.
- Celular: solo dígitos, 7–15; se quita el prefijo 591 si trae 11 dígitos.
- Menor de 18 (hora de La Paz): exige `guardianPhone` (CHECK en base + 400 en servicio).
- `is_minor` se guarda y se recalcula al editar; puede quedar desactualizado cuando cumple 18 hasta la próxima edición (supuesto documentado).
- Auditoría: `patient_created` (solo origen y esMenor) y `patient_updated` (solo campos cambiados); sin datos de contacto en la creación.

## Ficha del paciente (T-14)

- `GET /api/v1/admin/patients/:id/record` (requiere sesión, solo lectura): `PatientRecord` = datos del paciente + sus consultas (las más recientes primero, máx. 200) con estado, anticipo, comprobante (número y si está confirmado), diagnóstico, costo y motivo de cancelación. 404 si el paciente no existe.
- Cada apertura registra `patient_record_opened` (actor dentista) **sin copiar contenido**: ni contacto, ni diagnóstico. No se audita si el paciente no existe o no hay sesión.
- La historia clínica por versiones se suma en T-15 (la pantalla ya tiene el lugar).
- Web: `/panel/pacientes/[id]`, con el enlace «Ver ficha» en la lista de pacientes.

## Historia clínica por versiones (T-15)

- Tablas `clinical_record` (una por paciente) y `clinical_version` (numeradas, inmutables: un disparador rechaza UPDATE/DELETE con 23514). Migración `1765100000000`.
- `GET admin/patients/:id/clinical-history` (vigente + lista sin contenido), `GET .../versions/:n` (una versión), `PUT .../clinical-history` (guarda).
- Guardar compara el contenido normalizado (espacios, saltos de línea) con la versión vigente: sin cambios, o todo vacío, no crea versión (`saved: false`). Bloquea la fila de `clinical_record` (`FOR UPDATE`) para numerar bien aunque haya guardados simultáneos.
- Auditoría sin copiar contenido: `clinical_history_read`, `clinical_version_read`, `clinical_version_created`.
- El odontograma (T-16) se agregará como `tooth_state` ligado a la versión cuando llegue la lista de estados.
