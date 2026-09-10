# Plan — Sesiones y Memoria de Agentes (Postgres como fuente de verdad)

> Cómo Soma mantiene el contexto de una conversación y lo inyecta en cualquier
> runtime de agente (pi, opencode, claude-code, Glia).
> Última actualización: 2026-09-10
> Estado: 🟡 Diseño aprobado, implementación en curso (Fase 1)

**Issue paraguas**: [#192](https://github.com/ZeaCl/soma/issues/192)
**Task**: [task.md](task.md)
**Issues relacionados**: [#185](https://github.com/ZeaCl/soma/issues/185) · [#186](https://github.com/ZeaCl/soma/issues/186) · [soma-sdk-kotlin#2](https://github.com/ZeaCl/soma-sdk-kotlin/issues/2) · [nutrisnaps_ai_android#25](https://github.com/ZeaCl/nutrisnaps_ai_android/issues/25)

---

## 1. Problema

En conversaciones largas el agente "olvida" el contexto, repite tool calls y
responde que "no tiene memoria". Se identificaron **dos causas raíz distintas**:

| # | Causa raíz | Síntoma | Dónde se arregla |
|---|---|---|---|
| 1 | **Context window overflow** | Dentro de una misma sesión, el historial supera la ventana del LLM | pi auto-compaction + [#185](#) (Soma) |
| 2 | **Amnesia por reconexión** | Al reconectar el WebSocket, el proceso pi arranca una sesión nueva y pierde todo el hilo | **Este plan** |

La causa #2 es la más grave y estaba sin resolver. Evidencia en el código actual:

- `agent_socket.ex` → en cada `init` hace `AgentRunner.start_link(...)` **sin pasar
  el `conversation.id`**.
- `agent_runner.ex` → lanza `pi --mode rpc --session-dir <home>/.pi-sessions` **sin
  selector de sesión**. pi cae en `SessionManager.create(...)` → **sesión nueva**.
- Soma **nunca re-inyecta** el historial de Postgres al prompt de pi (solo lo
  guarda para el REST que consume el móvil).

Resultado: cada reconexión (cambio de tab, app en background, reconexión
automática del SDK) **mata el proceso pi y arranca de cero**. El usuario ve sus
mensajes (desde Soma REST) pero el LLM no los tiene.

---

## 2. Principio de diseño

> **La conversación vive en Soma (Postgres). La sesión del runtime es un caché
> efímero y descartable.**

Hoy compiten dos verdades: Postgres (Soma) y el `.jsonl` (pi). Se resuelve
declarando **Postgres autoritativo** y tratando la sesión del runtime como caché
regenerable.

Tres conceptos que hay que separar:

| Concepto | Dónde vive | Vida | Qué es |
|---|---|---|---|
| **Conversación** | Postgres (Soma) | Permanente | Hilo durable. Fuente de verdad. `conversation.id` (UUID). |
| **Sesión de runtime** | pi/opencode (jsonl) | Efímera | Working set del LLM durante el socket. **Caché.** |
| **Memoria** | Postgres (Soma) | Permanente | Contexto reconstruido que Soma entrega al runtime. |

**Clave de sesión = `conversation.id`.** Deja de ser por agente y pasa a ser por
conversación.

---

## 3. Arquitectura objetivo

```mermaid
graph TB
    subgraph Cliente
        APP[App móvil / CLI / glia-web]
    end

    subgraph Soma[ "Soma (hub) — dueño de la memoria" ]
        WS[AgentSocket]
        CONV[Conversations]
        MEM[Memory API]
        BUD[Context Budget]
        PG[(Postgres)]
        WS --> CONV
        CONV <--> PG
        MEM --> CONV
        MEM --> BUD
    end

    subgraph Runtimes[ "Runtimes de agente" ]
        PI[pi]
        OC[opencode]
        CC[claude-code]
        GL[Glia]
    end

    APP -->|WS cid| WS
    MEM -->|Context Bundle| APT[Adapters]
    APT -->|"pi: --session-id + ext"| PI
    APT -->|"opencode: AGENTS.md"| OC
    APT -->|"claude-code: CLAUDE.md"| CC
    APT -->|"Glia: LongTerm"| GL
```

### Flujo de conexión

```
Cliente WS (cid)
  │
  ├─► Soma resuelve/crea conversation (Postgres)
  │
  ├─► ¿existe sesión de runtime para este conversation.id?
  │     SÍ  → resumirla (fast path, sin reconstruir)
  │     NO  → Soma reconstruye el Context Bundle desde Postgres
  │            y lo publica para que el runtime lo inyecte
  │
  └─► Runtime corre con la sesión de esa conversación
```

---

## 4. Contrato: Context Bundle

Soma produce un **Context Bundle** agnóstico de runtime; cada adapter lo consume
a su manera (paralelo a `AgentEvents.Adapters.*`, que ya abstrae runtimes).

```json
{
  "conversationId": "uuid",
  "agentId": "...",
  "systemPrompt": "...",
  "summary": "resumen rodante de lo anterior",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "budget": { "maxTokens": 120000, "usedTokens": 45000 }
}
```

### Adapters de inyección (por runtime)

| Runtime | Mecanismo de sesión | Mecanismo de contexto |
|---|---|---|
| **pi** | `--session-id <conversation.id>` | Extensión pi que lee un archivo que Soma escribe (hook `session_start` / `before_agent_start`) |
| **opencode** | su propia sesión | `AGENTS.md` / MCP |
| **claude-code** | su propia sesión | `CLAUDE.md` / MCP |
| **Glia** | ya persiste por `conversation_id` | ya lo hace: `Glia.Memory.LongTerm.load_into_state/2` |

> **Decisión (Fase 2)**: la inyección en pi será **por archivo**, no por endpoint.
> Soma ya escribe `~/.pi/agent/config.json` en el home del agente; escribe también
> `~/.pi/agent/context/<conversation.id>.json` y una extensión pi chica lo inyecta.
> Sin red, sin auth, determinista (no depende de que el LLM decida "buscar memoria").

### Verificación técnica de pi (ya confirmada)

- `pi --session-id <id>` reanuda el archivo si existe, o lo crea con ese id.
- El regex de session-id es `[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]` → un UUID calza. ✅
- `cwd` ya es consistente (Soma hace `cd <home>`).
- Hooks `session_start` y `before_agent_start` permiten inyectar mensaje
  persistente y/o modificar el system prompt.
- Extensiones se auto-descubren desde `~/.pi/agent/extensions/*.ts`.

---

## 5. Política de contexto (memoria episódica)

Esto es lo que hoy figura en [#185](https://github.com/ZeaCl/soma/issues/185), y
**se reubica en Soma** (donde vive el historial), no en pi.

Al construir el bundle:

1. **System prompt** — siempre, nunca se trunca.
2. **Summary** (memoria comprimida) — si existe.
3. **Últimos N mensajes** dentro del presupuesto de tokens.
4. Al superar **~60–70%** del context window: Soma resume lo viejo, actualiza
   `summary` y suelta esos mensajes del bundle.

Campos nuevos en `conversations`:

| Campo | Tipo | Uso |
|---|---|---|
| `summary` | `text` | Resumen rodante de lo compactado. |
| `summary_covers_up_to` | `uuid` (message id) | Hasta dónde cubre el resumen. |

---

## 6. Fuera de alcance (explícito)

- **Neo4j / memoria semántica**: NO entra ahora. Solo Postgres. La interfaz
  `Memory API` queda preparada para agregar un backend de grafo después, sin
  tocar los runtimes.
- **Nota**: `Hippocampus` (preview environments) y `Engram` (ledger de
  documentos) **no son** memoria de agente, pese al nombre.

---

## 7. Fases de implementación

### Fase 0 — Diseño y contrato ✅
- [x] ADR: Postgres = fuente de verdad, sesión de runtime = caché.
- [x] Contrato Context Bundle.
- [x] Este plan + [task.md](task.md) + issue paraguas.

### Fase 1 — Sesión durable por conversación (P0)
**Objetivo**: reconectar ya no pierde memoria.
- [ ] `AgentSocket`: pasar `conversation.id` a `AgentRunner`.
- [ ] `AgentRunner`: lanzar pi con `--session-id <conversation.id>`.
- [ ] Test: dos `init` con el mismo `cid` reusan la misma sesión.

**Resultado**: dentro de una misma conversación, el `.jsonl` persiste entre
reconexiones. pi es el caché; Soma decide el id.

### Fase 2 — Soma autoritativo: reconstrucción desde Postgres (P0)
**Objetivo**: si el caché no existe, Soma lo reconstruye.
- [ ] Soma escribe `~/.pi/agent/context/<conversation.id>.json` (Context Bundle).
- [ ] Extensión pi `soma-context.ts` que en `session_start`/`before_agent_start`
      inyecta el bundle cuando la sesión es nueva.
- [ ] `Memory` module en Soma: `build_context/1` (prompt + summary + mensajes).
- [ ] Test: sesión borrada + reconnect → contexto reconstruido desde Postgres.

**Resultado**: el `.jsonl` se vuelve descartable. Postgres es la verdad.

### Fase 3 — Compactación / summary rodante (P1) ∈ #185
**Objetivo**: conversaciones largas sin overflow.
- [ ] Presupuesto de tokens configurable por agente (`maxContextTokens`,
      `preserveLastN`).
- [ ] Generación de `summary` al superar el umbral.
- [ ] `context_warning` (ya hecho en #187) sigue avisando al cliente.
- [ ] Test: 50+ turnos mantienen coherencia sin repetir tool calls.

**Resultado**: cierra las Fases 1–2 de [#185](https://github.com/ZeaCl/soma/issues/185)
en su ubicación correcta.

### Fase 4 — Adapters multi-runtime (P2)
**Objetivo**: la memoria sirve a cualquier runtime, no solo pi.
- [ ] Extraer `Soma.Memory.Adapters` (contrato común).
- [ ] Adapter opencode / claude-code.
- [ ] Verificar Glia (`LongTerm`) contra el contrato.
- [ ] Visibilidad en `glia-web`.

**Resultado**: proyectos multi-agente comparten la misma memoria.

---

## 8. Criterios de aceptación (global)

- [ ] Reconectar el chat no pierde contexto.
- [ ] Borrar el `.jsonl` de una conversación no pierde contexto (se reconstruye).
- [ ] El system prompt nunca se trunca.
- [ ] Una conversación de 50+ turnos mantiene coherencia.
- [ ] Agregar un runtime nuevo no toca la lógica de memoria (solo un adapter).
- [ ] Solo Postgres como almacén (sin Neo4j).

---

## 9. Decisiones abiertas

| # | Pregunta | Estado |
|---|---|---|
| D1 | ¿`conversation.id` como clave de sesión? | ✅ Aprobado |
| D2 | Inyección en pi: ¿archivo o endpoint? | ✅ Archivo (Fase 2) |
| D3 | ¿Neo4j ahora? | ✅ No — solo Postgres, interfaz preparada |
| D4 | ¿Servicio de memoria aparte o dentro de Soma? | 🟡 Soma primero; extraer si Glia lo necesita |

---

## 10. Referencias de código

| Archivo | Rol |
|---|---|
| `lib/soma_web/agent_socket.ex` | Punto de entrada WS; debe pasar `conversation.id` a `AgentRunner` |
| `lib/soma/agent_runner.ex` | Spawnea pi; debe usar `--session-id` |
| `lib/soma/conversations.ex` | Fuente de verdad; `list_messages_page/2` (cursor) |
| `lib/soma/agent_events/adapters/pi.ex` | Patrón de adapter a seguir para memoria |
| `soma-sdk-kotlin` `SomaChatViewModel` | Cliente: reconexión (PR #5) y paginación (PR #10) |
