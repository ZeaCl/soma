# Soma AgentHub — Multi-Engine Architecture

> Cada agente puede usar un motor de IA distinto (Pi, ReAct, OpenCode, Hermes, Goose…).
> El SDK y el protocolo WebSocket no cambian — el backend rutea según la config del agente.

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│                         Soma AgentHub                             │
│                                                                   │
│  Cliente (SDK)              Backend (agent-rpc.ts)                │
│  ════════════               ════════════════════                  │
│                                                                   │
│  useGlia({                  ws.on('init') →                       │
│    agentId: "agente-1"      │                                     │
│  })                         ├─ getAgentConfig(userId)             │
│       │                     │  → { systemPrompt, skills,          │
│       │ WebSocket           │      tools, workspacePaths,         │
│       │                     │      engine: 'pi'|'react'|... }     │
│       │ {type:"init",       │                                     │
│       │  uid:"agente-1"}    ├─ EngineRegistry.create(engine)      │
│       │                     │  → PiEngine | ReActEngine | ...     │
│       │                     │                                     │
│       │                     ├─ engine.createSession({             │
│       │                     │     systemPrompt,                   │
│       │                     │     skills,                         │
│       │                     │     tools,                          │
│       │                     │     workspace,                      │
│       │                     │     modelRegistry,                  │
│       │                     │     authStorage,                    │
│       │                     │   })                                │
│       │                     │                                     │
│       │ ← ready ←───────────┤                                     │
│       │                     │                                     │
│       │ {type:"prompt",     │                                     │
│       │  text:"..."}  →     ├─ session.prompt(text)               │
│       │                     │                                     │
│       │ ← thinking/delta ←──┤  session.subscribe(cb)              │
│       │ ← tool_call    ←─── │    → cb({type:'thinking', text})    │
│       │ ← done         ←─── │    → cb({type:'delta', text})       │
│       │                     │    → cb({type:'done'})              │
│       │                     │                                     │
│       │ {type:"cancel"} →   ├─ session.abort()                    │
│       │ ← cancelled ←───────┤                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Engine Interface

Cada motor implementa esta interfaz. El protocolo WebSocket es agnóstico al motor.

```typescript
// engines/types.ts

export interface AgentConfig {
  systemPrompt: string | null
  skillPaths: string[]
  tools: string[]
  workspacePaths: string[]
  modelRegistry: ModelRegistry
  authStorage: AuthStorage
  resourceLoader?: ResourceLoader
}

export interface StreamEvent {
  type: 'thinking_start' | 'thinking' | 'thinking_end'
       | 'delta' | 'tool_use' | 'tool_result'
       | 'done' | 'error'
  text?: string
  name?: string
  input?: unknown
  content?: string
  message?: string
}

export interface AgentSession {
  prompt(text: string): Promise<void>
  subscribe(callback: (event: StreamEvent) => void): void
  abort(): Promise<void>
}

export interface AgentEngine {
  /** Human-readable name */
  name: string
  /** Create a new session for this agent configuration */
  createSession(config: AgentConfig): Promise<AgentSession>
}
```

---

## Engine Registry

```typescript
// engines/registry.ts

import type { AgentEngine } from './types'

const engines = new Map<string, AgentEngine>()

export const EngineRegistry = {
  register(name: string, engine: AgentEngine) {
    engines.set(name, engine)
  },

  get(name: string): AgentEngine | undefined {
    return engines.get(name)
  },

  list(): string[] {
    return [...engines.keys()]
  }
}
```

---

## Motores

### 1. Pi Engine (`pi`)

```typescript
// engines/pi-engine.ts
// Motor actual — usa @earendil-works/pi-coding-agent

import { createAgentSession, SessionManager } from '@earendil-works/pi-coding-agent'
import type { AgentEngine, AgentConfig, AgentSession } from './types'

export const PiEngine: AgentEngine = {
  name: 'pi',

  async createSession(config: AgentConfig): Promise<AgentSession> {
    const sm = SessionManager.continueRecent(process.cwd(), config.sessionDir)
    const result = await createAgentSession({
      sessionManager: sm,
      authStorage: config.authStorage,
      modelRegistry: config.modelRegistry,
      tools: config.tools as any,
      ...(config.resourceLoader ? { resourceLoader: config.resourceLoader } : {}),
      ...(config.systemPrompt ? { systemPromptOverride: config.systemPrompt } : {}),
    })

    return {
      prompt: (text) => result.session.prompt(text),
      subscribe: (cb) => result.session.subscribe((event: any) => {
        if (event.type === 'message_update') {
          const msg = event.assistantMessageEvent
          cb({ type: msg.type, text: msg.delta || msg.name || msg.content } as any)
        }
      }),
      abort: () => result.session.abort(),
    }
  }
}
```

### 2. ReAct Engine (`react`)

```typescript
// engines/react-engine.ts
// Motor basado en LangChain/LangGraph con agentes ReAct

import type { AgentEngine, AgentConfig, AgentSession, StreamEvent } from './types'

export const ReActEngine: AgentEngine = {
  name: 'react',

  async createSession(config: AgentConfig): Promise<AgentSession> {
    // TODO: integrar con LangChain/LangGraph
    // const agent = await createReActAgent({ ... })
    throw new Error('ReAct engine: not implemented')
  }
}
```

### 3. OpenCode Engine (`opencode`)

```typescript
// engines/opencode-engine.ts
// https://github.com/opencode-ai/opencode

import type { AgentEngine } from './types'

export const OpenCodeEngine: AgentEngine = {
  name: 'opencode',
  async createSession(config) {
    throw new Error('OpenCode engine: not implemented')
  }
}
```

### 4. Hermes Engine (`hermes`)

```typescript
// engines/hermes-engine.ts

import type { AgentEngine } from './types'

export const HermesEngine: AgentEngine = {
  name: 'hermes',
  async createSession(config) {
    throw new Error('Hermes engine: not implemented')
  }
}
```

### 5. Goose Engine (`goose`)

```typescript
// engines/goose-engine.ts
// https://block.github.io/goose/

import type { AgentEngine } from './types'

export const GooseEngine: AgentEngine = {
  name: 'goose',
  async createSession(config) {
    throw new Error('Goose engine: not implemented')
  }
}
```

---

## Registro de motores (al iniciar)

```typescript
// server/agent-rpc.ts — startup

import { EngineRegistry } from './engines/registry'
import { PiEngine } from './engines/pi-engine'
import { ReActEngine } from './engines/react-engine'
import { OpenCodeEngine } from './engines/opencode-engine'
import { HermesEngine } from './engines/hermes-engine'
import { GooseEngine } from './engines/goose-engine'

// Register available engines
EngineRegistry.register('pi', PiEngine)
EngineRegistry.register('react', ReActEngine)
EngineRegistry.register('opencode', OpenCodeEngine)
EngineRegistry.register('hermes', HermesEngine)
EngineRegistry.register('goose', GooseEngine)
```

---

## Ruteo en el WebSocket handler

```typescript
// agent-rpc.ts — ws.on('init')

ws.on('message', async (raw) => {
  // ...

  if (type === 'init') {
    const config = await getAgentConfig(userId)

    // El motor viene de la config del agente (Thalamus)
    const engineName = config?.engine || 'pi'  // ← 'pi' | 'react' | 'opencode' | ...
    const engine = EngineRegistry.get(engineName)

    if (!engine) {
      ws.send(JSON.stringify({ type: 'error', message: `Unknown engine: ${engineName}` }))
      return
    }

    console.log(`🔧 Init: user=${userId} engine=${engineName}`)

    session = await engine.createSession({
      systemPrompt: config?.systemPrompt || null,
      skillPaths: config?.skillPaths || [],
      tools: config?.tools || ['read', 'bash', 'edit', 'write'],
      workspacePaths: config?.workspacePaths || [],
      modelRegistry,
      authStorage,
      resourceLoader: config?.resourceLoader,
      sessionDir: join(SESSION_DIR, conversationId || userId),
    })

    // Subscribe — mismo formato para todos los motores
    session.subscribe((event) => {
      ws.send(JSON.stringify(event))
    })

    ws.send(JSON.stringify({ type: 'ready' }))
  }

  // prompt, cancel — igual para todos los motores
  if (type === 'prompt' && session) {
    await session.prompt(text)
    // done lo emite el motor vía subscribe
  }

  if (type === 'cancel' && session) {
    await session.abort()
    ws.send(JSON.stringify({ type: 'cancelled' }))
  }
})
```

---

## Configuración del motor por agente

El campo `engine` se agrega al `agent_config` en Thalamus:

```json
// Thalamus: PUT /api/users/:id
{
  "agent_config": {
    "engine": "pi",              // ← NUEVO: 'pi' | 'react' | 'opencode' | 'hermes' | 'goose'
    "system_prompt": "Eres un asistente financiero...",
    "skills": ["xlsx", "venture"],
    "tools": ["read", "bash", "edit", "write"],
    "workspace_paths": ["/workspace/orgs/org-1/app"]
  }
}
```

Campo `engine` también en el archivo de config local:

```json
// /root/.agents/agent-configs/{userId}.json
{
  "engine": "react",
  "system_prompt": "...",
  "workspace_paths": ["..."]
}
```

---

## Plan de implementación

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | Crear `engines/types.ts` — interfaces `AgentEngine`, `AgentSession`, `AgentConfig` | Nuevo | 30m |
| 2 | Crear `engines/registry.ts` — `EngineRegistry` | Nuevo | 15m |
| 3 | Crear `engines/pi-engine.ts` — extraer lógica actual de `agent-rpc.ts` | Nuevo | 1h |
| 4 | Crear stubs: `react-engine.ts`, `opencode-engine.ts`, `hermes-engine.ts`, `goose-engine.ts` | Nuevos | 30m |
| 5 | Refactor `agent-rpc.ts` — usar `EngineRegistry` en vez de `createAgentSession` directo | Modificar | 1h |
| 6 | Agregar campo `engine` a `AgentConfig` interface en `agent-rpc.ts` | Modificar | 15m |
| 7 | Agregar `engine` al `fetchAgentConfig()` — leer de Thalamus y archivo local | Modificar | 30m |
| 8 | Agregar `PUT /api/agents/:id/config` soporte para `engine` en `api_controller.ex` | Modificar | 15m |
| 9 | Test: mismo backend, 2 agentes con distinto engine | E2E | 1h |
| 10 | Test: agente sin engine → usa `pi` por defecto | E2E | 30m |

**Esfuerzo total: ~6 horas**

---

## Cómo se ve desde el SDK

```tsx
// El SDK NO cambia. El engine es transparente.

<GliaChat
  agentId="agente-finanzas"    // engine=pi en Thalamus → usa Pi
/>

<GliaChat
  agentId="code-reviewer"      // engine=opencode en Thalamus → usa OpenCode
/>

// Ambos usan el mismo protocolo WebSocket.
// Ambos muestran thinking, delta, tools igual.
```

---

## Agregar un motor nuevo

```typescript
// 1. Crear engines/mi-engine.ts
export const MiEngine: AgentEngine = {
  name: 'mi-engine',
  async createSession(config) {
    // Inicializar tu motor...
    return {
      prompt: async (text) => { /* ... */ },
      subscribe: (cb) => { /* emitir StreamEvent */ },
      abort: async () => { /* ... */ },
    }
  }
}

// 2. Registrarlo en agent-rpc.ts
EngineRegistry.register('mi-engine', MiEngine)

// 3. Usarlo desde Thalamus
// agent_config.engine = "mi-engine"
```
