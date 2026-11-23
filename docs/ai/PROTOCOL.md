# PROTOCOL — memoria y trabajo entre IAs

**Estado:** borrador, pendiente de aprobación.

## Al inicio de cada sesión

1. Medir Git local y remoto, sin escribir: HEAD, branch, `git status`, upstream, remotes, último commit. Si no hay acceso, reportar `NO VERIFICADO`.
2. Leer Nivel 0: AGENTS, PROTOCOL, MASTER, `STATUS` vigente, resumen de `HANDOFF`.
3. Leer Nivel 1 solo según tarea: ROADMAP, DECISIONS/ADR, DATA-MODEL, MODULE.md relevante.
4. Leer Nivel 2 si hay pregunta técnica concreta: código histórico, demo visual, pruebas, documentación detallada.
5. Proponer objetivo, archivos afectados, riesgo y validaciones. No editar si la tarea exige antes una aprobación clínica/ADR.

## Durante el trabajo

- Vertical slice: contrato → migración → lógica API → UI → tests → evidencia.
- No asumir que la demo Lúmina hace reservas reales.
- Razonar a partir de las reglas vigentes (Word + respuestas del cliente en `VALIDACION-REQUISITOS.md` §6–§6.3): un dentista, franjas de 45 min, reserva de 8 min, anticipo único por QR externo, pago confirmado manualmente, cinco estados, historial versionado.
- Ante contradicción: registrar desviación, no sustituir requisito por suposición.
- Seguir least privilege y privacidad; no exponer historia clínica a endpoints públicos.
- Nunca describir test no ejecutado como PASS. Documentar comando, entorno, fecha y resultado de cada validación.

## Al cerrar

- Dejar resumen verificable: tarea, archivos, pruebas, resultados, riesgos, pendientes y siguiente paso.
- `STATUS.md` describe el estado **observado**, no futuro; `HANDOFF.md` permite reanudar sin chat. `as_of_sha` debe ser el SHA observado, no inventado.
- Solicitar autorizaciones **STAGE**, **COMMIT**, **PUSH**, **DEPLOY** por separado; no encadenarlas sin autorización inequívoca.
- Quien reciba la entrega compara Git y tests antes de declarar estados `committed/pushed/deployed`.

## Matriz de cierre

| Hecho | Documento dueño |
|---|---|
| Reglas de sesión y protección | AGENTS / PROTOCOL |
| Visión y arquitectura aceptada | MASTER / DECISIONS |
| Planificación de tareas | ROADMAP |
| Situación observada y bloqueos | STATUS |
| Último trabajo y reanudación | HANDOFF |
| Contrato de un módulo específico | `MODULE.md` junto al código |
| Modelo de tablas y diagramas | DATA-MODEL |

No duplicar textos extensos; enlazar al dueño.
