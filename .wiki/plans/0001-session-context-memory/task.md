# Task — Sesiones y Memoria de Agentes

> Checklist de avance del [plan](plan.md). Se actualiza a medida que se completa
> cada ítem. Fuente del plan: `.wiki/plans/0001-session-context-memory/plan.md`.
> Última actualización: 2026-09-10

**Issue paraguas**: [#192](https://github.com/ZeaCl/soma/issues/192)
**Rama principal**: `feat/192-session-memory` *(a crear)*
**Estado global**: 🟡 En curso — Fase 1 ✅, Fase 2 siguiente

---

## Fase 0 — Diseño y contrato ✅

- [x] ADR: Postgres = fuente de verdad, sesión de runtime = caché
- [x] Contrato Context Bundle definido
- [x] `plan.md` escrito
- [x] `task.md` escrito
- [x] Issue paraguas creado en GitHub ([#192](https://github.com/ZeaCl/soma/issues/192))

---

## Fase 1 — Sesión durable por conversación (P0) ✅

> Objetivo: reconectar el chat no pierde memoria. Clave de sesión = `conversation.id`.

- [x] `AgentSocket.handle_init/4` pasa `conversation.id` a `AgentRunner.start_link`
- [x] `AgentRunner.init/1` acepta `:conversation_id`
- [x] `AgentRunner` agrega `--session-id <conversation.id>` a los args de pi
- [x] Validar que el UUID cumple el regex de session-id de pi (`pi_session_id/1`)
- [x] Fallback: si no hay `conversation_id`, mantener comportamiento actual
- [x] Test: `pi_session_id/1` valida UUIDs y rechaza inválidos
- [x] Test: `conversation_id` persistido en el estado del AgentRunner
- [x] `mix test test/soma/agent_runner_test.exs` → 18/18 verde
- [x] PR abierto: [#193](https://github.com/ZeaCl/soma/pull/193)

---

## Fase 2 — Soma autoritativo: reconstrucción desde Postgres (P0) ⏳

> Objetivo: si el caché no existe, Soma lo reconstruye desde Postgres.

- [ ] Módulo `Soma.Memory` con `build_context/1`
  - [ ] System prompt del agente
  - [ ] `summary` (si existe)
  - [ ] Últimos N mensajes dentro del presupuesto
- [ ] `AgentRunner` escribe `~/.pi/agent/context/<conversation.id>.json`
- [ ] Extensión pi `soma-context.ts`
  - [ ] Hook `session_start`: si la sesión es nueva, inyectar el bundle
  - [ ] Hook `before_agent_start`: refrescar si el bundle cambió
- [ ] Test: borrar sesión pi + reconnect → contexto reconstruido
- [ ] Test: bundle no se inyecta dos veces si la sesión ya lo tiene
- [ ] PR abierto

---

## Fase 3 — Compactación / summary rodante (P1) ∈ #185 ⏳

> Objetivo: conversaciones largas sin overflow. Reubica #185 en Soma.

- [ ] Columnas `summary` + `summary_covers_up_to` en `conversations` (migración)
- [ ] Presupuesto de tokens por agente (`maxContextTokens`, `preserveLastN`)
- [ ] Generación de `summary` al superar ~60–70% del context window
- [ ] El bundle usa summary + últimos N (no todo el historial)
- [ ] `context_warning` (ya hecho en #187) sigue funcionando
- [ ] Test: 50+ turnos mantienen coherencia
- [ ] Test: el system prompt nunca se trunca
- [ ] PR abierto

---

## Fase 4 — Adapters multi-runtime (P2) ⏳

> Objetivo: la memoria sirve a pi, opencode, claude-code y Glia.

- [ ] Extraer `Soma.Memory.Adapters` (contrato común)
- [ ] Adapter opencode
- [ ] Adapter claude-code
- [ ] Verificar Glia (`Glia.Memory.LongTerm`) contra el contrato
- [ ] Visibilidad en `glia-web`
- [ ] PR abierto

---

## Decisiones registradas

| # | Decisión | Estado |
|---|---|---|
| D1 | `conversation.id` es la clave de sesión | ✅ Aprobado |
| D2 | Inyección en pi por archivo, no endpoint | ✅ Aprobado |
| D3 | Solo Postgres (sin Neo4j); interfaz preparada | ✅ Aprobado |
| D4 | Memoria dentro de Soma primero; extraer si Glia lo pide | 🟡 Abierta |

---

## Bitácora

| Fecha | Acción | Archivos |
|---|---|---|
| 2026-09-10 | Fase 0 completada: plan + task escritos | `.wiki/plans/0001-session-context-memory/*` |
| 2026-09-10 | Fase 1 completada: sesión durable por conversación (`--session-id`) | `lib/soma/agent_runner.ex`, `lib/soma_web/agent_socket.ex`, `test/soma/agent_runner_test.exs` |
