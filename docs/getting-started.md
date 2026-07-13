# Getting Started

Soma is used in different ways depending on who you are and what you're building. Pick your path:

---

## 🟦 Dev: Integrating Soma in My App

You have a React app and want to add AI agent chat, file workspace, or skill management.

### Quickest path

#### 1. Install the SDK

```bash
npm install @zea.cl/soma-sdk
```

#### 2. Add GliaChat

```tsx
import { GliaChat } from '@zea.cl/soma-sdk'
import '@zea.cl/soma-sdk/styles/base.css'

function App() {
  return (
    <div style={{ height: '100vh' }}>
      <GliaChat
        agentId="your-agent-id"
        apiKey="zs_live_xxx..."
        baseUrl="https://soma.zea.cl"
      />
    </div>
  )
}
```

That's it. WebSocket connection, message streaming, tool calls — all handled by the SDK.

#### 3. Auth setup

Soma supports two auth methods:

| Method | Use case | Prop |
|---|---|---|
| JWT Bearer (Thalamus) | Web apps with OAuth2 login | `apiKey={jwtToken}` |
| API Key | Server-side, CI/CD, internal tools | `apiKey="zs_live_xxx"` |

If you're in the ZEA ecosystem, Thalamus handles OAuth2 PKCE for you. Use `@zea.cl/auth` in your app and pass the JWT to Soma:

```tsx
const { token } = useThalamus(config)
<GliaChat agentId={userId} apiKey={token} baseUrl="http://soma.zea.localhost" />
```

#### 4. Customize

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
  welcomeMessage="¡Hola! Soy tu asistente. ¿En qué puedo ayudarte?"
/>
```

#### 5. Dive deeper

- [React SDK Guide](integrations/react-sdk.md) — All components and hooks
- [API Reference](api/overview.md) — REST API endpoints
- [Integration Guide](../INTEGRATION_GUIDE.md) — Full step-by-step

---

## 🟣 Admin: Manage Agents

You administer agents, skills, API keys, and workspaces in an existing Soma deployment.

### Quickest path

#### 1. Get an API key

Login to Soma and generate an API key at `/settings/api-keys`. Keys have format `zs_live_...`.

#### 2. Manage agents

```bash
# CLI
soma agents list
soma agents create --name "Code Reviewer" --skills "review,test"
soma agents skills <agent-id>

# REST API
curl https://soma.zea.cl/api/agents \
  -H "x-api-key: zs_live_xxx"
```

#### 3. Manage skills

```bash
soma skills list
soma skills install <name>
```

#### 4. Manage workspaces

```bash
# Create sandbox for a user
curl -X POST https://soma.zea.cl/api/sandboxes \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type": "user", "user_id": "..."}'

# Upload file to user workspace
curl -X POST https://soma.zea.cl/api/files/unified/upload \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"owner_type": "user", "owner_id": "...", "name": "data.xlsx", "data": "<base64>"}'
```

#### 5. Dive deeper

- [Agents API](api/agents.md)
- [Skills API](api/skills.md)
- [Sandboxes API](api/sandboxes.md)

---

## 🟡 Architect: Understand the System

You want to understand how Soma is built, its design decisions, and how to extend it.

### Architecture at a glance

Soma runs as a single Docker container with **two processes**:

```
Container: soma
├── Pi Sidecar (Node.js :3002)
│   └── agent-rpc.ts → WebSocket agents + HTTP endpoints
│       ├── init → fetchAgentSkills(Thalamus) → prepareAgent → RpcBridge
│       ├── prompt → stdin JSONL → pi --mode rpc → stdout → WebSocket events
│       └── cancel → abort subprocess
│
├── Elixir API (Phoenix :4084)
│   └── Plug.Router → REST API
│       ├── /api/conversations → CRUD + messages (PostgreSQL)
│       ├── /api/files → workspace files (disk + sandbox)
│       ├── /api/skills → skills CRUD
│       ├── /api/agents → agent management
│       └── /api/sandboxes → sandbox lifecycle
│
└── Sandbox Layer (Linux users)
    └── /home/soma-{shortId}/ (agents) + /home/user-{shortId}/ (humans)
```

### Key design decisions

- **Linux users for isolation**: kernel-enforced, no Docker-in-Docker
- **`sudo -u` over `spawn({uid, gid})`**: more portable
- **Dual-write PostgreSQL**: Pi Sidecar writes messages directly, Elixir API manages CRUD
- **Skills as markdown files**: copied to agent home, read by `pi --mode rpc`
- **SDK with zero UI dependencies**: inline styles + CSS variables, no conflicts

### Dive deeper

- [README](../README.md)
- [Isolation Plan](../PLAN-ISOLATION.md)
- [Rules & Patterns](../.wiki/rules.md) (internal)
- [Session State](../.wiki/session-state.md) (internal)

---

## Environment Reference

| Environment | URL | Auth |
|---|---|---|
| ZEA Cloud (production) | `https://soma.zea.cl` | JWT via Thalamus |
| Local development | `http://soma.zea.localhost` | JWT via Thalamus |
| Internal (Docker network) | `http://soma:4084` | JWT or API key |
