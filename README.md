# 🧬 ZEA Soma — AgentHub

**Multi-agent chat, skills, workspaces & sandboxed execution.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

---

## 🏗️ Arquitectura real (2 procesos)

Soma tiene **2 procesos** que corren en el mismo contenedor Docker:

```
┌──────────────────────────────────────────────┐
│  CONTENEDOR Soma (Alpine Linux)              │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  PID 1: start.sh                     │    │
│  │  ├─ Pi Sidecar (:3002)              │    │
│  │  │   agent-rpc.ts                   │    │
│  │  │   ├─ HTTP API (conversaciones,   │    │
│  │  │   │   skills, archivos)          │    │
│  │  │   └─ WebSocket (chat agentes)    │    │
│  │  │       ├─ init → prepara sandbox  │    │
│  │  │       ├─ prompt → bridge RPC     │    │
│  │  │       └─ cancel → abort          │    │
│  │  │                                  │    │
│  │  └─ Elixir API (:4084)              │    │
│  │      Phoenix (Plug.Router)          │    │
│  │      ├─ Conversaciones (DB)         │    │
│  │      ├─ Workspace Files             │    │
│  │      ├─ Skills CRUD                 │    │
│  │      ├─ API Keys                    │    │
│  │      └─ Agent Management            │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  Sandbox Layer (OS)                  │    │
│  │                                      │    │
│  │  /home/soma-{shortId}/              │    │
│  │    ├── workspace/    (archivos)      │    │
│  │    ├── .agents/skills/ (solo suyas) │    │
│  │    ├── .pi-sessions/ (sesiones pi)  │    │
│  │    └── .pi/agent/    (auth, config) │    │
│  │                                      │    │
│  │  Ejecución: sudo -u soma-{id} pi    │    │
│  │  Aislamiento: permisos UNIX 700     │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### Flujo de un prompt

```
1. Cliente WebSocket → { type:"init", uid, cid }
2. agent-rpc.ts → fetchAgentSkills(userId) → Thalamus
3. agent-rpc.ts → prepareAgent(agentId, skills)
4. agent-sandbox.ts → soma-agent-useradd → usuario Linux
5. agent-sandbox.ts → copia skills a /home/soma-{id}/.agents/skills/
6. agent-rpc.ts → new RpcBridge({ username, home })
7. RpcBridge → sudo -u soma-{id} pi --mode rpc --session-dir /home/...
8. pi CLI → lee skills de ~/.agents/skills/
9. stdin/stdout JSONL ↔ eventos tipados ↔ WebSocket
```

---

## 🔐 Aislamiento

Cada agente es un **usuario Linux real** (`soma-{first12chars}`) con:

| Recurso | Aislamiento |
|---------|-------------|
| **Home** | `/home/soma-{shortId}/` — chmod 700 |
| **Skills** | Copiadas a `~/.agents/skills/` — solo las asignadas |
| **Workspace** | `~/workspace/` — solo el agente escribe |
| **Sesiones** | `~/.pi-sessions/` — separadas por home |
| **Ejecución** | `sudo -u soma-{id}` — kernel-enforced |

---

## 📂 Estructura del proyecto

```
soma/
├── lib/                    # Backend Elixir (Phoenix Plug.Router)
│   ├── soma/               #   Lógica de negocio
│   │   ├── application.ex
│   │   ├── conversations.ex
│   │   ├── workspace.ex
│   │   ├── sandbox.ex
│   │   ├── skills.ex
│   │   ├── api_key.ex
│   │   └── agent_share.ex
│   └── soma_web/           #   Web layer
│       ├── router.ex
│       ├── endpoint.ex
│       ├── controllers/api_controller.ex
│       └── plugs/          #   Auth (JWT, API Key)
│
├── server/                 # Pi Sidecar (Node.js + TypeScript)
│   ├── agent-rpc.ts        #   WebSocket + HTTP server (:3002)
│   ├── agent-sandbox.ts    #   Sandbox lifecycle (create/destroy)
│   └── rpc-bridge.ts       #   Bridge stdin/stdout ↔ pi --mode rpc
│
├── sdk/                    # @zea/soma-sdk (React)
│   └── src/
│
├── scripts/                # OS-level sandbox
│   ├── soma-agent-useradd  #   Crea usuario Linux + home
│   └── soma-agent-userdel  #   Destruye usuario Linux
│
├── cli/                    # CLI (npm)
├── ui/                     # Landing page
├── skill/                  # Skills para AI agents
├── Dockerfile              # Multi-stage build
└── start.sh                # Entrypoint (lanza ambos procesos)
```

---

## 🚀 Quick Start

```bash
npm install @zea/soma-sdk
```

```tsx
import { GliaChat } from '@zea/soma-sdk'
import '@zea/soma-sdk/styles/base.css'

<GliaChat
  agentId="full-stack-dev"
  apiKey="zs_live_xxx"
  baseUrl="https://soma.zea.cl"
/>
```

---

## 📦 Componentes SDK

| Component | Descripción |
|---|---|
| `GliaChat` | Chat con agente IA (WebSocket) |
| `GliaCopilot` | Panel lateral de asistente |
| `GliaConversationList` | Historial de conversaciones |
| `GliaFileBrowser` | Workspace file browser |
| `GliaSkillEditor` | Editor de skills |

## 🪝 Hooks SDK

| Hook | Descripción |
|---|---|
| `useGlia()` | WebSocket chat: `send`, `cancel`, `messages`, `isStreaming` |
| `useGliaConversations()` | Listar conversaciones |
| `useGliaFiles()` | Workspace files |
| `useGliaSkills()` | Skills management |
| `useGliaAgents()` | Agent management |

---

## 🎨 Theme

```tsx
<GliaChat
  agentId="..."
  apiKey="..."
  colors={{
    bg: '#0d1117',
    userBubble: '#238636',
    agentBubble: '#21262d',
    thinkingText: '#a78bfa',
    primary: '#238636',
  }}
/>
```

---

## 📄 Documentación

- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Plan de Aislamiento](./PLAN-ISOLATION.md)

## 📄 Licencia

Apache 2.0 — [ZEA Platform](https://github.com/zeacl)
