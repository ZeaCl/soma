---
name: soma-agents
description: "Integrar Soma AgentHub en cualquier plataforma ZEA. Usar cuando se necesita agregar chat con agentes IA, gestionar conversaciones, archivos, skills, o workflows. Triggers: 'integrar Soma', 'agregar chat de agente', 'GliaChat', '@zea/soma-sdk', 'agenthub', 'agent chat in my app'."
---

# Soma Agents — AgentHub Integration

## 🎯 What it does

Soma is the **AgentHub** for ZEA Platform. It provides chat, files, skills, and multi-agent orchestration. The `@zea/soma-sdk` lets any React app embed agent chat, file browsers, skill editors, and conversation lists with zero backend code.

```
npm install @zea/soma-sdk
```

## ⚡ 30-Second Integration

```tsx
import { GliaChat } from '@zea/soma-sdk'

// In your React component:
<GliaChat
  agentId={userId}              // User ID from Thalamus JWT
  baseUrl="http://soma.zea.localhost"  // Soma service URL
  welcomeMessage="¡Hola! Soy tu agente."
/>
```

That's it. WebSocket connection, message streaming, tool calls — all handled by the SDK.

---

## 📦 SDK Components

| Component | Props | Use case |
|-----------|-------|----------|
| `<GliaChat>` | `agentId`, `conversationId?`, `baseUrl?`, `welcomeMessage?` | Full chat interface with agent |
| `<GliaCopilot>` | `agentId`, `baseUrl?` | Floating chat button |
| `<GliaConversationList>` | `agentId`, `baseUrl?`, `onSelect?` | Conversation history sidebar |
| `<GliaFileBrowser>` | `agentId`, `baseUrl?` | File workspace browser |
| `<GliaSkillEditor>` | `agentId`, `baseUrl?` | Skill configuration editor |

## 🪝 Hooks

| Hook | Returns | Use case |
|------|---------|----------|
| `useGlia(options)` | `{ send, cancel, messages, isStreaming, streamContent }` | Low-level chat control |
| `useGliaConversations()` | `{ conversations, loading }` | Fetch conversation list |
| `useGliaFiles()` | `{ files, upload, delete }` | File management |
| `useGliaSkills()` | `{ skills, update }` | Skill management |
| `useGliaAgents()` | `{ agents, create, update }` | Agent CRUD |

---

## 🔐 Auth Setup

Soma uses **Thalamus OAuth2 PKCE**. See `thalamus-auth` skill for full setup.

### Quick setup for a new SPA:

```bash
# 1. Register OAuth2 client in Thalamus DB
docker exec zea_thalamus_local bin/thalamus rpc '
client = %Thalamus.Infrastructure.Persistence.Schemas.OAuth2ClientSchema{
  id: Ecto.UUID.generate(),
  client_id_string: "my_app_service",
  name: "My App",
  client_type: :public,
  is_active: true,
  allowed_grant_types: ["authorization_code", "refresh_token"],
  allowed_scopes: ["openid", "profile", "email"],
  redirect_uris: ["http://my-app.zea.localhost/callback"],
  pkce_required: true,
  token_endpoint_auth_method: "none",
  organization_id: "5fd11ea0-852c-44e5-aee1-a761ec76eaea"
}
Thalamus.Repo.insert!(client)
'

# 2. Add CORS origins in docker-compose
CORS_ORIGINS: "...,http://my-app.zea.localhost,..."
```

### PKCE Implementation (TypeScript)

```typescript
// oauth.ts
const AUTH = 'http://auth.zea.localhost'
const CLIENT = 'my_app_service'
const REDIRECT = window.location.origin + '/callback'

export function generatePKCE() {
  const v = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const c = crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))
    .then(h => btoa(String.fromCharCode(...new Uint8Array(h)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))
  return { verifier: v, challenge: c }
}

export function getAuthUrl(challenge: string) {
  return `${AUTH}/oauth/authorize?${new URLSearchParams({
    client_id: CLIENT, redirect_uri: REDIRECT,
    response_type: 'code', code_challenge: challenge,
    code_challenge_method: 'S256', scope: 'openid',
    state: crypto.randomUUID()
  })}`
}

export async function exchangeCode(code: string, verifier: string) {
  const r = await fetch(`${AUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code',
      client_id: CLIENT, code, code_verifier: verifier, redirect_uri: REDIRECT })
  })
  return (await r.json()).access_token
}
```

---

## 🏗️ Integration Patterns

### Pattern 1: Standalone (like soma.zea.localhost)

Full app with landing, login, and 3-column layout. Soma is the entire app.

```
App.tsx
├── Landing.tsx       (hero + CTA)
├── Login.tsx         (OAuth2 PKCE → Thalamus)
└── ChatView.tsx      (3-column: sidebar + content + GliaChat)
```

### Pattern 2: Embedded in Cranium (like Südlich)

Soma as a piece in Cranium's iframe. No sidebar/topbar — just the content.

```tsx
// Piece loaded in Cranium iframe
import { GliaChat, GliaFileBrowser } from '@zea/soma-sdk'
import { useCraniumContext } from './useCraniumContext'

function SomaPiece() {
  const ctx = useCraniumContext() // { org_id, user, params }
  return (
    <GliaChat agentId={ctx.user.id} baseUrl="http://soma.zea.localhost" />
  )
}
```

### Pattern 3: Copilot (floating button)

Just the floating chat button, no full layout.

```tsx
import { GliaCopilot } from '@zea/soma-sdk'

function MyApp() {
  return (
    <>
      <MyDashboard />
      <GliaCopilot agentId={userId} baseUrl="http://soma.zea.localhost" />
    </>
  )
}
```

---

## 🖥️ CLI

```bash
npm install -g @zea/soma-cli

# Auth
soma login                    # OAuth2 PKCE flow
soma logout

# Agents
soma agents list              # List agents for current org
soma agents create --name "Code Reviewer" --skills "review,test"
soma agents skills <id>       # List skills for an agent

# Conversations
soma conversations list <agent-id>
soma conversations create <agent-id>

# Files
soma files list
soma files upload <path>

# Skills
soma skills list
soma skills install <name>

# Chat
soma chat <agent-id>          # Interactive chat in terminal
```

---

## 🧪 Testing Integration

```bash
# 1. Verify Soma health
curl http://soma.zea.localhost/health

# 2. Test WebSocket connection
wscat -c ws://soma.zea.localhost/agent-ws
# Send: {"type":"init","uid":"4c4e2791-...","cid":"test"}

# 3. Test GliaChat in browser
open http://soma.zea.localhost
# Click "Get Started" → Login → Chat with agent
```

---

## ⚠️ Common Issues

| Issue | Fix |
|-------|-----|
| WebSocket won't connect | Check Caddy route: `/agent-ws` → `soma:3002` |
| GliaChat renders blank | Verify `agentId` is valid UUID, check browser console |
| Messages not saving | Check Soma DB: `soma_prod` schema, conversations table |
| Skills not loading | Check Thalamus agent-config for that user |
| CORS on token exchange | Add domain to `CORS_ORIGINS` in Thalamus docker-compose |
