# Soma AgentHub — Integration Guide

> Cómo integrar agentes de IA en tu app React usando `@zea/soma-sdk`.

---

## Quick Start (3 pasos)

### 1. Obtener credenciales

```
https://soma.zea.cl → Launch AgentHub → Login → API Keys → Generate
```

Guarda el API key (formato `zs_live_...`). Es por organización — todos los agentes de tu org la comparten.

### 2. Instalar

```bash
npm install @zea/soma-sdk
```

### 3. Usar

```tsx
import { GliaChat } from '@zea/soma-sdk'
import '@zea/soma-sdk/styles/base.css'

function App() {
  return (
    <div style={{ height: '100vh' }}>
      <GliaChat
        agentId="full-stack-dev"          // ← tu agente
        apiKey="zs_live_xxx..."           // ← tu API key
        baseUrl="https://soma.zea.cl"
      />
    </div>
  )
}
```

---

## Opciones de autenticación

### A. API Key (server-side apps, CI/CD, internal tools)

```tsx
<GliaChat
  agentId="code-reviewer"
  apiKey="zs_live_xxx"
  baseUrl="https://soma.zea.cl"
/>
```

### B. OAuth2 PKCE (SPA multi-usuario)

```tsx
// 1. Redirect a auth.zea.cl para login
const authUrl = `https://auth.zea.cl/oauth/authorize?` +
  `client_id=soma_service&` +
  `redirect_uri=${window.location.origin}/callback&` +
  `response_type=code&` +
  `code_challenge=${challenge}&` +
  `code_challenge_method=S256&` +
  `scope=openid profile email`

// 2. En el callback, intercambiar code por token
const res = await fetch('https://auth.zea.cl/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    client_id: 'soma_service',
    code: params.get('code'),
    code_verifier: verifier,
    redirect_uri: `${window.location.origin}/callback`,
  }),
})
const { access_token } = await res.json()

// 3. Extraer agentId del JWT
const payload = JSON.parse(atob(access_token.split('.')[1]))
const agentId = payload.sub.replace(/^user_/, '')

// 4. Usar GliaChat con el token
<GliaChat
  agentId={agentId}
  baseUrl="https://soma.zea.cl"
  authHeaders={() => ({ Authorization: `Bearer ${access_token}` })}
/>
```

### C. Agente config manual (sin identity service)

```tsx
<GliaChat
  agentId="mi-agente"
  baseUrl="https://soma.zea.cl"
  agentConfig={{
    systemPrompt: 'Eres un asistente experto en TypeScript...',
    tools: ['read', 'bash'],
    engine: 'pi',
  }}
/>
```

---

## Customización visual

```tsx
<GliaChat
  agentId="..."
  apiKey="..."
  colors={{
    bg: '#0d1117',
    userBubble: '#238636',
    agentBubble: '#21262d',
    thinkingBg: 'rgba(139, 92, 246, 0.08)',
    thinkingText: '#a78bfa',
    primary: '#238636',
    font: 'system-ui, sans-serif',
    radius: '12px',
  }}
  placeholder="Preguntale al agente..."
  welcomeMessage="¡Hola! Soy tu asistente de código."
/>
```

---

## API Reference

### `<GliaChat>`

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `agentId` | `string` | requerido | ID del agente a usar |
| `apiKey` | `string` | — | API key de Soma |
| `baseUrl` | `string` | `window.location.origin` | URL base de Soma |
| `wsPath` | `string` | `'/agent-ws'` | Path del WebSocket |
| `authHeaders` | `() => Record<string,string>` | `x-api-key` | Factory de headers de auth |
| `agentConfig` | `object` | — | Config directa del agente |
| `colors` | `Partial<GliaChatColors>` | — | Override de colores |
| `className` | `string` | — | Clase CSS del root |
| `placeholder` | `string` | `'Mensaje...'` | Placeholder del input |
| `welcomeMessage` | `string` | `'¡Hola!...'` | Mensaje inicial |
| `renderMessage` | `(msg, default) => ReactNode` | — | Custom render de mensajes |
| `renderInput` | `(default) => ReactNode` | — | Custom render del input |

### `useGlia()`

```tsx
import { useGlia } from '@zea/soma-sdk'

const { send, cancel, messages, isStreaming, isConnected } = useGlia({
  agentId: 'mi-agente',
  apiKey: 'zs_live_xxx',
  baseUrl: 'https://soma.zea.cl',
})
```

### Hooks REST

```tsx
import { useGliaConversations, useGliaFiles, useGliaSkills } from '@zea/soma-sdk'

const { conversations, loading } = useGliaConversations('zs_live_xxx', 'https://soma.zea.cl')
const { files } = useGliaFiles('zs_live_xxx')
const { skills } = useGliaSkills('zs_live_xxx')
```

---

## Sin backend ZEA

Si tenés tu propio backend WebSocket que habla el protocolo de Soma:

```tsx
<GliaChat
  agentId="..."
  baseUrl="https://mi-backend.com"
  wsPath="/custom-ws"
  authHeaders={() => ({ Authorization: `Bearer ${miToken}` })}
/>
```

El backend solo necesita implementar el protocolo WebSocket:
- `{type:"init", uid, cid}` → `{type:"ready"}`
- `{type:"prompt", text}` → `{type:"thinking"|"delta"|"done"}`

---

## Sandbox Provider

```tsx
import { GliaFileBrowser, createMemorySandboxProvider } from '@zea/soma-sdk'

const sandbox = createMemorySandboxProvider()
sandbox.writeFile('/readme.md', '# Mi Proyecto')

<GliaFileBrowser sandbox={sandbox} />
```

---

## CLI

```bash
# Instalar (bash + curl)
curl -sL https://soma.zea.cl/cli/install.sh | bash

# Usar
export SOMA_API_KEY=zs_live_xxx
soma-agent agent list
soma-agent engine list
soma-agent conversation chat mi-agente
```
