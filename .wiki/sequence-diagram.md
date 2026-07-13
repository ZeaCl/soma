# Diagrama de Secuencia — Chat Soma x Südlich

> Flujo completo: desde que el usuario escribe un mensaje hasta que ve la respuesta.

```mermaid
sequenceDiagram
    actor U as 👤 Usuario
    participant GC as 🖥️ GliaChat<br/>(React SDK)
    participant C as 🔀 Caddy<br/>(:80)
    participant EA as 🧪 Elixir API<br/>(soma:4084)
    participant PS as ⚡ Pi Sidecar<br/>(soma:3002)
    participant AS as 🏠 agent-sandbox.ts
    participant RB as 🌉 RpcBridge
    participant PI as 🤖 pi CLI<br/>(--mode rpc)
    participant LLM as 🧠 LLM Provider<br/>(DeepSeek/Anthropic)

    %% ═══ FASE 0: Inicialización (primera vez) ═══

    Note over U,LLM: ═══════ FASE 0: Inicialización del agente ═══════

    U->>GC: Abre la app, selecciona agente
    GC->>C: ws://soma.zea.localhost/agent-ws
    C->>PS: WebSocket upgrade → soma:3002
    PS->>PS: ws.on('connection')

    GC->>PS: {"type":"init","uid":"4c4e2791...","cid":"..."}
    Note over PS: Recibe init

    PS->>PS: fetchAgentSkills(agentId)
    Note over PS: Lee skills del filesystem:<br/>/home/soma-{id}/.agents/skills/

    PS->>AS: prepareAgent(agentId, skillNames)
    AS->>AS: 1. ensureUser() → soma-agent-useradd
    Note over AS: Crea usuario Linux<br/>/home/soma-4c4e2791/

    AS->>AS: 2. copySkills(home, skillNames)
    Note over AS: Copia skills a<br/>~/.agents/skills/

    AS-->>PS: { username, home, uid, gid }

    PS->>RB: new RpcBridge({ username, home })
    PS->>RB: bridge.start()
    Note over RB: sudo -u soma-4c4e2791 bash -c<br/>'HOME=/home/soma-4c4e2791 pi --mode rpc'
    RB->>PI: spawn pi --mode rpc
    PI->>PI: Lee skills de ~/.agents/skills/
    PI-->>RB: {"type":"ready"}
    RB-->>PS: Evento 'ready'
    PS-->>GC: {"type":"ready"}
    GC->>GC: readyRef = true, isConnected = true

    %% ═══ FASE 1: Usuario escribe mensaje ═══

    Note over U,LLM: ═══════ FASE 1: Usuario escribe un mensaje ═══════

    U->>GC: Escribe "¿Cuál es mi workspace?"
    GC->>GC: send("¿Cuál es mi workspace?")
    Note over GC: Añade burbuja del usuario<br/>al chat (optimista)

    GC->>PS: {"type":"prompt","text":"¿Cuál es mi workspace?"}
    Note over PS: Recibe prompt

    PS->>RB: bridge.prompt("¿Cuál es mi workspace?")
    RB->>PI: stdin: {"type":"prompt","message":"..."}
    Note over PI: pi procesa con skills

    PI->>LLM: API call (DeepSeek/Anthropic)

    %% ═══ FASE 2: El LLM piensa y responde ═══

    Note over U,LLM: ═══════ FASE 2: El agente piensa y responde ═══════

    LLM-->>PI: Streaming de tokens
    PI-->>RB: stdout: {"type":"thinking","text":"..."}

    loop Por cada fragmento de respuesta
        RB-->>PS: Evento 'thinking' o 'text'
        PS-->>GC: {"type":"thinking","text":"..."}
        GC->>GC: Muestra "pensando..." en gris

        PI-->>RB: stdout: {"type":"text","text":"Tu workspace..."}
        RB-->>PS: Evento 'text'
        PS-->>GC: {"type":"delta","text":"Tu workspace..."}
        GC->>GC: Streaming de texto en burbuja
        GC->>U: El usuario ve la respuesta<br/>aparecer palabra por palabra
    end

    LLM-->>PI: Fin de respuesta
    PI-->>RB: stdout: {"type":"done"}
    RB-->>PS: Evento 'done'
    PS-->>GC: {"type":"done","conversationId":"..."}
    GC->>GC: isStreaming = false<br/>Mensaje completo en estado

    Note over U: ✅ El usuario ve la respuesta completa

    %% ═══ FASE 3: Tool calls (si el agente usa herramientas) ═══

    Note over U,LLM: ═══════ FASE 3: Tool calls (opcional) ═══════

    U->>GC: Escribe "Lee el archivo datos.csv"
    GC->>PS: {"type":"prompt","text":"Lee el archivo datos.csv"}
    PS->>RB: prompt("Lee el archivo datos.csv")
    RB->>PI: stdin: prompt

    PI->>LLM: API call
    LLM-->>PI: Tool call: read_file("datos.csv")
    PI-->>RB: {"type":"tool_call","name":"read_file","input":{"path":"datos.csv"}}

    RB->>RB: Ejecuta el tool en el sandbox
    Note over RB: Lee /home/soma-4c4e2791/workspace/datos.csv
    RB-->>PI: stdin: {"type":"tool_result","content":"..."}

    PI->>LLM: Continuar con resultado del tool
    LLM-->>PI: Respuesta basada en datos
    PI-->>RB: stdout: {"type":"text","text":"El archivo contiene..."}
    RB-->>PS: forwarding...
    PS-->>GC: {"type":"delta","text":"El archivo contiene..."}

    Note over U: ✅ El usuario ve la respuesta<br/>basada en el archivo leído

    %% ═══ FASE 4: Cancelación ═══

    Note over U,LLM: ═══════ FASE 4: Cancelación (opcional) ═══════

    U->>GC: Click en "Cancelar"
    GC->>PS: {"type":"cancel"}
    PS->>RB: bridge.cancel()
    RB->>PI: stdin: {"type":"abort"}
    PI->>PI: Mata el proceso LLM
    PI-->>RB: {"type":"cancelled"}
    RB-->>PS: Evento 'cancelled'
    PS-->>GC: {"type":"cancelled"}
    GC->>GC: Muestra "⏹️ Cancelado"
    GC->>U: ✅ Usuario ve mensaje cancelado
```

---

## 🗺️ Mapa de puertos y rutas

```
┌─────────────────────────────────────────────────────────┐
│  NAVEGADOR                                               │
│  http://sudlich-soma.zea.localhost                       │
│                                                          │
│  GliaChat                                                │
│  ├─ HTTP :80  → Caddy → sudlich-soma:3099 (frontend)    │
│  ├─ REST     → Caddy → soma:4084 (Elixir API)           │
│  └─ WS       → Caddy → soma:3002 (Pi Sidecar) ⚡         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  CADDY (:80)                                             │
│  /agent-ws     → soma:3002  (WebSocket agentes)          │
│  /api/*        → soma:4084  (REST API)                   │
│  /*            → soma:4084  (SPA fallback)                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  CONTENEDOR SOMA (Alpine Linux)                          │
│                                                          │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Elixir API (:4084)  │  │ Pi Sidecar (:3002)       │  │
│  │                     │  │                          │  │
│  │ /health             │  │ ws.on('init')            │  │
│  │ /api/conversations  │  │   → fetchAgentSkills()   │  │
│  │ /api/files          │  │   → prepareAgent()       │  │
│  │ /api/skills         │  │   → new RpcBridge()      │  │
│  │ /api/agents         │  │                          │  │
│  │ /api/sandboxes      │  │ ws.on('prompt')          │  │
│  │                     │  │   → bridge.prompt()      │  │
│  │ PostgreSQL ◄────────┼──┤                          │  │
│  └─────────────────────┘  │ ws.on('cancel')          │  │
│                            │   → bridge.cancel()      │  │
│  ┌─────────────────────┐  └──────────┬───────────────┘  │
│  │ Sandbox Layer (OS)  │             │                   │
│  │                     │             ▼                   │
│  │ /home/soma-{id}/    │  ┌──────────────────────────┐  │
│  │   workspace/        │  │ RpcBridge                │  │
│  │   .agents/skills/   │  │                          │  │
│  │   .pi-sessions/     │  │ sudo -u soma-{id} \      │  │
│  │                     │  │   pi --mode rpc          │  │
│  │ chmod 700           │  │                          │  │
│  └─────────────────────┘  │ stdin/stdout JSONL       │  │
│                            └──────────┬───────────────┘  │
│                                       │                   │
│                                       ▼                   │
│                            ┌──────────────────────────┐  │
│                            │ pi CLI (--mode rpc)      │  │
│                            │                          │  │
│                            │ - Lee ~/.agents/skills/  │  │
│                            │ - API keys del entorno   │  │
│                            │ - Llama a LLM provider   │  │
│                            └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Protocolo de mensajes

### Cliente → Servidor (WebSocket JSON)

| Tipo | Campos | Cuándo |
|---|---|---|
| `init` | `uid`, `cid?` | Al abrir el chat |
| `prompt` | `text` | Usuario escribe mensaje |
| `cancel` | — | Usuario clickea cancelar |

### Servidor → Cliente (WebSocket JSON)

| Tipo | Campos | Significado |
|---|---|---|
| `ready` | `message` | Agente inicializado, listo para prompts |
| `thinking` | `text` | El modelo está razonando |
| `delta` | `text` | Fragmento de respuesta (streaming) |
| `tool` | `name`, `input` | El agente llamó una herramienta |
| `done` | `conversationId` | Respuesta completa |
| `cancelled` | — | Generación cancelada |
| `error` | `message` | Error |

### RpcBridge ↔ pi CLI (stdin/stdout JSONL)

| Dirección | Tipo | Uso |
|---|---|---|
| stdin → | `prompt` | Enviar mensaje |
| stdin → | `abort` | Cancelar |
| stdin → | `tool_result` | Resultado de tool |
| stdout ← | `thinking` | Razonamiento |
| stdout ← | `text` | Respuesta |
| stdout ← | `tool_call` | Llamada a herramienta |
| stdout ← | `done` | Terminado |
```
