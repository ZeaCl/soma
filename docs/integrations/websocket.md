# WebSocket API — Agent Chat

Real-time agent chat via WebSocket. Used by `GliaChat` component internally.

---

## Connection

```
ws://soma.zea.localhost/agent-ws
wss://soma.zea.cl/agent-ws
```

---

## Authentication

Include API key as query param:

```
ws://soma.zea.localhost/agent-ws?api_key=zs_live_xxx
```

Or pass JWT Bearer:

```
ws://soma.zea.localhost/agent-ws?token=eyJhbGciOi...
```

---

## Protocol (JSON messages)

### Client → Server

| Type | Payload | Description |
|---|---|---|
| `init` | `{ uid: string, cid?: string }` | Initialize agent session. `uid` = agent/user ID, `cid` = optional conversation ID |
| `prompt` | `{ text: string }` | Send user message to agent |
| `cancel` | `{}` | Abort current generation |

### Server → Client

| Type | Fields | Description |
|---|---|---|
| `ready` | `{ message: string }` | Agent sandbox prepared and ready |
| `thinking` | `{ content: string }` | Agent's reasoning (streaming) |
| `text` | `{ content: string }` | Agent's response (streaming) |
| `tool_call` | `{ tool_name: string, tool_input: object }` | Agent is calling a tool |
| `tool_result` | `{ content: string }` | Tool execution result |
| `done` | `{ conversationId: string }` | Response complete |
| `error` | `{ message: string }` | Error occurred |

---

## Example Session

```javascript
const ws = new WebSocket('ws://soma.zea.localhost/agent-ws?api_key=zs_live_xxx')

ws.onopen = () => {
  // Initialize agent
  ws.send(JSON.stringify({
    type: 'init',
    uid: 'agent-uuid',
    cid: 'optional-conversation-id'
  }))
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)

  switch (msg.type) {
    case 'ready':
      console.log('Agent ready:', msg.message)
      // Send first prompt
      ws.send(JSON.stringify({
        type: 'prompt',
        text: 'Analyze the Q4 data'
      }))
      break

    case 'thinking':
      console.log('💭', msg.content)
      break

    case 'text':
      console.log('🤖', msg.content)
      break

    case 'tool_call':
      console.log('🔧', msg.tool_name, msg.tool_input)
      break

    case 'tool_result':
      console.log('📋', msg.content)
      break

    case 'done':
      console.log('✅', 'Conversation:', msg.conversationId)
      break

    case 'error':
      console.error('❌', msg.message)
      break
  }
}

// Cancel generation
ws.send(JSON.stringify({ type: 'cancel' }))
```

---

## Flow Diagram

```
Client                  Server                  Sandbox
  │                        │                        │
  │── init(uid, cid) ────→│                        │
  │                        │── fetchAgentSkills ──→│ (Thalamus)
  │                        │── prepareAgent ──────→│ (useradd + skills)
  │←── ready ─────────────│                        │
  │                        │                        │
  │── prompt("Analyze") ──→│                        │
  │                        │── prompt ────────────→│ (pi --mode rpc)
  │←── thinking ──────────│←── thinking ──────────│
  │←── tool_call ─────────│←── tool_call ─────────│
  │←── tool_result ───────│←── tool_result ───────│
  │←── text ──────────────│←── text ──────────────│
  │                        │                        │
  │── cancel ─────────────→│                        │
  │                        │── kill subprocess ───→│
  │←── error("cancelled") ─│                        │
  │                        │                        │
  │── prompt("Continue") ─→│                        │
  │←── text ──────────────│                        │
  │←── done(convId) ──────│                        │
```

---

## Error Handling

| Error | Cause | Recovery |
|---|---|---|
| Connection refused | Soma not running | Retry with exponential backoff |
| `auth_failed` | Invalid API key / JWT | Check credentials |
| `agent_not_found` | Invalid agent ID | Verify agent exists in Thalamus |
| `sandbox_failed` | Linux user creation failed | Check container logs |
| `bridge_error` | pi CLI crashed | Retry — sidecar auto-restarts |
| Timeout | Agent took too long | Send `cancel` and retry |
