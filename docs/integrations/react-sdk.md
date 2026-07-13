# React SDK — @zea.cl/soma-sdk

Complete guide to integrating Soma in any React 18/19 app.

---

## Installation

```bash
npm install @zea.cl/soma-sdk
```

```tsx
import '@zea.cl/soma-sdk/styles/base.css'
```

---

## Components

### GliaChat — Full chat interface

```tsx
import { GliaChat } from '@zea.cl/soma-sdk'

<GliaChat
  agentId="full-stack-dev"
  apiKey="zs_live_xxx..."
  baseUrl="https://soma.zea.cl"
  welcomeMessage="¡Hola! Soy tu asistente."
  placeholder="Escribe un mensaje..."
  conversationId="conv_abc123"
  colors={{
    bg: '#0d1117',
    userBubble: '#238636',
    agentBubble: '#21262d',
    thinkingText: '#a78bfa',
    primary: '#238636',
  }}
/>
```

**Props**:

| Prop | Type | Required | Default |
|---|---|---|---|
| `agentId` | `string` | ✅ | — |
| `apiKey` | `string` | ❌ | — |
| `baseUrl` | `string` | ❌ | — |
| `conversationId` | `string` | ❌ | — |
| `welcomeMessage` | `string` | ❌ | — |
| `placeholder` | `string` | ❌ | `"Type a message..."` |
| `className` | `string` | ❌ | — |
| `colors` | `Partial<GliaChatColors>` | ❌ | — |

### GliaCopilot — Floating chat button

```tsx
import { GliaCopilot } from '@zea.cl/soma-sdk'

<App>
  <Dashboard />
  <GliaCopilot agentId={userId} baseUrl="http://soma.zea.localhost" />
</App>
```

Opens a floating chat panel from a FAB button (bottom-right).

### GliaConversationList — History sidebar

```tsx
import { GliaConversationList } from '@zea.cl/soma-sdk'

<GliaConversationList
  agentId={agentId}
  baseUrl="http://soma.zea.localhost"
  onSelect={(conversationId) => setActiveConv(conversationId)}
/>
```

### GliaFileBrowser — Workspace file browser

```tsx
import { GliaFileBrowser } from '@zea.cl/soma-sdk'

<GliaFileBrowser agentId={agentId} baseUrl="http://soma.zea.localhost" />
```

### GliaFileViewer — File preview

```tsx
import { GliaFileViewer } from '@zea.cl/soma-sdk'
import { useGliaFileContent } from '@zea.cl/soma-sdk'

const { content, loading } = useGliaFileContent('/path/to/file.csv')
<GliaFileViewer file={{ name: 'data.csv', content }} />
```

### UserWorkspace — User file workspace

```tsx
import { UserWorkspace } from '@zea.cl/soma-sdk'

<UserWorkspace
  ownerType="user"
  ownerId={userId}
  baseUrl="http://soma.zea.localhost"
  authHeaders={() => ({ Authorization: `Bearer ${token}` })}
/>
```

**Props**:

| Prop | Type | Required | Default |
|---|---|---|---|
| `ownerType` | `'user' \| 'org'` | ✅ | — |
| `ownerId` | `string` | ✅ | — |
| `baseUrl` | `string` | ❌ | — |
| `authHeaders` | `() => Record<string,string>` | ❌ | — |
| `colors` | `Partial<UserWorkspaceColors>` | ❌ | — |

### UserFileDropZone — Drag & drop upload

```tsx
import { UserFileDropZone } from '@zea.cl/soma-sdk'

<UserFileDropZone
  ownerType="user"
  ownerId={userId}
  baseUrl="http://soma.zea.localhost"
  authHeaders={() => ({ Authorization: `Bearer ${token}` })}
  onUploadComplete={(file) => console.log('Uploaded:', file)}
/>
```

---

## Hooks

### useGlia — WebSocket chat control

```tsx
import { useGlia } from '@zea.cl/soma-sdk'

function ChatController() {
  const { send, cancel, messages, isStreaming, streamContent } = useGlia({
    agentId: 'my-agent',
    baseUrl: 'http://soma.zea.localhost',
    conversationId: 'conv_123',
  })

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i} className={msg.role}>
          {msg.content}
          {msg.thinking && <small>{msg.thinking}</small>}
        </div>
      ))}
      <input onKeyDown={e => { send(e.target.value); e.target.value = '' }} />
      {isStreaming && <button onClick={cancel}>Stop</button>}
    </div>
  )
}
```

### Other hooks

```tsx
const { conversations, loading } = useGliaConversations()
const { files, upload, delete: del } = useGliaFiles()
const { content, loading } = useGliaFileContent('/path/to/file')
const { skills, update } = useGliaSkills()
const { agents, create, update } = useGliaAgents()
```

---

## Auth

### JWT Bearer (Thalamus)

```tsx
import { useThalamus } from '@zea.cl/auth'

function App() {
  const { token } = useThalamus(thalamusConfig)
  return <GliaChat agentId={userId} apiKey={token} baseUrl="..." />
}
```

### API Key

```tsx
<GliaChat agentId="agent-id" apiKey="zs_live_xxx..." baseUrl="..." />
```

---

## Theming

All components accept a `colors` prop with partial overrides. Full theme via CSS variables:

```css
:root {
  --glia-bg: #0d1117;
  --glia-user-bubble: #238636;
  --glia-agent-bubble: #21262d;
  --glia-thinking-text: #a78bfa;
  --glia-primary: #238636;
}
```
