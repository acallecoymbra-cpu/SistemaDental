# MASTER — visión, contratos y jerarquía

**Proyecto:** Renovando Sonrisas, sistema dental web 2.0.
**Estado:** documentación inicial en revisión, implementación no iniciada en repositorio observado.

## Fuentes

1. **Funcional:** documento de requerimientos v4.2 del cliente, aún pendiente de validación. Sus 15 CU, 28 RF, 14 RNF y supuestos S-01…S-14 no deben reescribirse implícitamente.
2. **Método y stack:** `docs/BRIEF-SISTEMA-DENTAL.md` del repo existente, sujeto a ADR.
3. **Visual:** `docs/referencia/lumina-dental/` como demo ficticia, no producto funcional. Su tabla «Qué se puede aprovechar» queda reemplazada por `docs/PLAN.md` §6.
4. **Decisiones aceptadas:** `docs/ai/DECISIONS.md` (solo las de Status ACEPTADA).
5. **Estado real:** verificación de código y tests primero; luego Git y snapshot STATUS.

## Alcance acordable

Un dentista, pacientes sin cuenta (nombre + celular), inicios cada 45 min desde el día siguiente (duración pendiente), anticipo único 10–20 Bs sobre consulta de 30 Bs por QR externo, comprobante único, verificación manual, cuatro estados de cita, historia clínica versionada, correo solo para cancelación y chat fijo. Las respuestas del cliente del 2026-11-20 (`docs/VALIDACION-REQUISITOS.md` §6) prevalecen sobre el Word donde lo contradicen. Cualquier ampliación (roles, móvil, pasarela, IA, inventario) necesita nuevo requisito.

## Arquitectura de referencia (pendiente de ADR)

Web Next.js 15/React 19 + API NestJS 11 + TypeORM 0.3 con migraciones + PostgreSQL propuesto + contratos TypeScript compartidos. Un monorepo pnpm/Turborepo, Node 24. Correo por outbox, HTTPS y sesiones opacas. Validez final supeditada a decisiones aprobadas.

## Responsabilidades

- **Propietario/cliente:** acepta requerimientos, ADR y autoriza operaciones Git/despliegue.
- **ChatGPT:** analítica de requisitos, arquitectura/roadmap, detecta inconsistencias.
- **Claude Code:** implementación por task asignada y evidencia real.
- **Codex:** revisión crítica de código/seguridad/tests cuando se le encomiende.
- **QA:** criterios de aceptación, pruebas reproducibles, no sobreafirmar cobertura.

## Contratos no negociables

- Confirmación de pago y bloqueo de franja deben ser atómicos en base de datos.
- Historia clínica por versiones inmutables, escritura exclusiva del dentista.
- El paciente público nunca ve datos clínicos ni de otros pacientes.
- No `PUSH` directo a GitHub si se aprueba Forgejo canónico/mirror; verificar configuración real primero.
- Ninguna herramienta se atribuye pruebas, merges o despliegues no observados.

Ver `docs/PLAN.md`, `docs/DATA-MODEL.md`, `docs/VALIDACION-REQUISITOS.md`.
