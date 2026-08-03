# 🧬 ZEA Soma — AgentHub

**Multi-agent chat, skills, workspaces & sandboxed execution.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

---

## 🏗️ Arquitectura

Soma corre como un único proceso Elixir en un contenedor Docker:

```
┌──────────────────────────────────────────────┐
│  CONTENEDOR Soma (Alpine Linux)              │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  Elixir API (:4084)                  │    │
│  │  Plug.Router                         │    │
│  │  ├─ REST API                         │    │
│  │  │   ├─ Conversaciones (DB)          │    │
│  │  │   ├─ Workspace Files              │    │
│  │  │   ├─ Skills CRUD                  │    │
│  │  │   ├─ API Keys                     │    │
│  │  │   └─ Agent Management             │    │
│  │  ├─ WebSocket /agent-ws             │    │
│  │  │   └─ AgentSocket                  │    │
│  │  └─ AgentRunner                      │    │
│  │      └─ pi --mode rpc (subprocess)   │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  Sandbox Layer (OS)                  │    │
│  │                                      │    │
│  │  /home/soma-{shortId}/              │    │
│  │    ├── workspace/    (archivos)      │    │
│  │    ├── skills/       (solo suyas)    │    │
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
2. AgentSocket → AgentRunner.start(agent_id, session_dir)
3. AgentRunner → Sandbox.create → soma-agent-useradd → usuario Linux
4. AgentRunner → copia skills a /home/soma-{id}/skills/
5. AgentRunner → spawn pi --mode rpc --session-dir /home/...
6. pi CLI → lee skills de ~/skills/
7. stdin/stdout JSONL ↔ eventos tipados ↔ WebSocket
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
├── lib/                    # Backend Elixir (Plug.Router)
│   ├── soma/               #   Lógica de negocio
│   │   ├── application.ex
│   │   ├── agent_runner.ex     #   pi --mode rpc subprocess manager
│   │   ├── agent_events.ex     #   Eventos de agente tipados
│   │   ├── conversations.ex
│   │   ├── workspace.ex
│   │   ├── sandbox.ex
│   │   ├── user_sandbox.ex
│   │   ├── org_workspace.ex
│   │   ├── skills.ex
│   │   ├── api_key.ex
│   │   ├── agent_shares.ex
│   │   ├── agent_dashboard.ex
│   │   ├── secret_provider.ex
│   │   └── thalamus_client.ex
│   └── soma_web/           #   Web layer
│       ├── router.ex
│       ├── endpoint.ex
│       ├── agent_socket.ex     #   WebSocket chat handler
│       ├── controllers/
│       │   ├── agent_controller.ex
│       │   ├── conversation_controller.ex
│       │   ├── file_controller.ex
│       │   ├── sandbox_controller.ex
│       │   └── skill_controller.ex
│       └── plugs/          #   Auth (JWT, API Key)
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
└── start.sh                # Entrypoint
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
