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

## Fase 2 — Soma autoritativo: reconstrucción desde Postgres (P0) ✅

> Objetivo: si el caché no existe, Soma lo reconstruye desde Postgres.

- [x] Módulo `Soma.Memory` con `build_context/1`
  - [x] System prompt del agente
  - [x] `summary` (si existe)
  - [x] Últimos N mensajes dentro del presupuesto
- [x] `AgentRunner` escribe `~/.pi/agent/context/<conversation.id>.json`
- [x] Extensión pi `soma-context.ts`
  - [x] Hook `before_agent_start`: inyecta el bundle si la sesión es nueva/fría
  - [x] No duplica si la sesión ya contiene mensajes previos
- [x] Test: Context Bundle estructurado desde Postgres (`test/soma/memory_test.exs`)
- [x] Test: bundle escrito a disco por `AgentRunner` al iniciar sesión (`test/soma/agent_runner_test.exs`)
- [ ] PR abierto

---

## Fase 3 — Compactación / summary rodante (P1) ∈ #185 ✅

> Objetivo: conversaciones largas sin overflow. Reubica #185 en Soma.

- [x] Columnas `summary` + `summary_covers_up_to` en `conversations` (migración)
- [x] Presupuesto de tokens por agente (`maxContextTokens`, `preserveLastN`)
- [x] Generación de `summary` al superar umbral de context window (`Memory.compact_conversation/2`)
- [x] El bundle usa summary + últimos N (no todo el historial)
- [x] `context_warning` (ya hecho en #187) sigue funcionando y gatilla la compactación en background
- [x] Test: compactación rodante y actualización de summary en `conversations` (`test/soma/memory_test.exs`)
- [x] Test: el system prompt y resumen acumulado se integran en el Context Bundle
- [ ] PR abierto

---

## Fase 4 — Adapters multi-runtime (P2) ✅

> Objetivo: la memoria sirve a pi, opencode, claude-code y Glia.

- [x] Extraer `Soma.Memory.Adapter` (behaviour y contrato común)
- [x] Adapter `Pi` (`Soma.Memory.Adapters.Pi`)
- [x] Adapter `Opencode` (`Soma.Memory.Adapters.Opencode`)
- [x] Adapter `ClaudeCode` (`Soma.Memory.Adapters.ClaudeCode`)
- [x] Adapter `Glia` (`Soma.Memory.Adapters.Glia`) verificado contra `Glia.Memory.LongTerm`
- [x] Despachador `Memory.inject_context/5` con fallback retrocompatible `Memory.write_context_file/4`
- [x] Visibilidad en `glia-web` / dashboards: `summary` y `summaryCoversUpTo` expuestos en `ConversationView` y función de inspección `Memory.inspect_context/2`
- [x] Tests unitarios completos en `test/soma/memory/adapters_test.exs`
- [ ] PR abierto

---

## Decisiones registradas

| # | Decisión | Estado |
|---|---|---|
| D1 | `conversation.id` es la clave de sesión | ✅ Aprobado |
| D2 | Inyección en pi por archivo, no endpoint | ✅ Aprobado |
| D3 | Solo Postgres (sin Neo4j); interfaz preparada | ✅ Aprobado |
| D4 | Memoria dentro de Soma primero; extraer si Glia lo pide | ✅ Resuelto vía Adapters |

---

## Bitácora

| Fecha | Acción | Archivos |
|---|---|---|
| 2026-09-10 | Fase 0 completada: plan + task escritos | `.wiki/plans/0001-session-context-memory/*` |
| 2026-09-10 | Fase 1 completada: sesión durable por conversación (`--session-id`) | `lib/soma/agent_runner.ex`, `lib/soma_web/agent_socket.ex`, `test/soma/agent_runner_test.exs` |
| 2026-09-11 | Fase 2 completada: reconstrucción autoritativa de contexto desde Postgres | `lib/soma/memory.ex`, `priv/extensions/soma-context.ts`, `lib/soma/agent_runner.ex`, tests |
| 2026-09-11 | Fase 3 completada: compactación rodante persistida en Postgres y resumen acumulado | `priv/repo/migrations/*`, `lib/soma/conversation.ex`, `lib/soma/conversations.ex`, `lib/soma/memory.ex`, `lib/soma/agent_runner.ex`, tests |
| 2026-09-11 | Fase 4 completada: adapters multi-runtime (pi, opencode, claude-code, glia) y visibilidad en glia-web | `lib/soma/memory/adapter.ex`, `lib/soma/memory/adapters/*`, `lib/soma/memory.ex`, `lib/soma_web/views/conversation_view.ex`, tests |


