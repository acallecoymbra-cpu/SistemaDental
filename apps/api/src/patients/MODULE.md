# Módulo `patients` (T-05)

Pacientes de la clínica. Los crea la doctora desde el panel (origen `dentist`); el portal público los creará en T-06 (origen `web`).

## Rutas (`admin/patients`, requieren sesión)

- `GET ?q=` busca por nombre (sin tildes ni mayúsculas), por celular (también el del apoderado) o por CI exacto. Máx. 50.
- `GET :id`, `POST`, `PATCH :id`. No hay `DELETE`: los pacientes no se borran.

## Reglas

- Nombre por partes (V-27): `givenNames`, `firstSurname`, `secondSurname?`. `fullName` se arma con las partes (solo lectura). Claves `first_given_name_key`, `given_names_key`, `first_surname_key`, `second_surname_key`: sin tildes, minúsculas, solo a–z («De la Roca» → `delaroca`).
- Identidad: índice único `patient_identity_uq` = claves de nombres y apellidos + país + celular (409 si se repite). Mismo celular con otro nombre = otro paciente + aviso `SHARED_PHONE_WARNING`.
- Celular con país (`phoneCountryCode`: 591, 54, 55, 56, 51, 595, 1, 34): se guarda el número nacional; Bolivia exactamente 8 dígitos, los demás 6–14; si pegan el prefijo del país se quita.
- CI (V-26): opcional en el panel; mayúsculas, sin espacios ni puntos, `^[0-9A-Z-]{4,20}$`; único si existe (`patient_ci_uq` → 409 «Ese CI ya pertenece a otro paciente.»). Nunca en la auditoría (solo `ciChanged: true`).
- Búsqueda pública (`patient-lookup.ts`): primer nombre o todos los nombres + primer apellido + país + celular propio o del apoderado. La usan «Mis consultas» y la reserva de quien vuelve.
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
