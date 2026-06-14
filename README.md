# 🧬 ZEA Soma — AgentHub

**Multi-agent chat, skills, workspaces & sandboxed execution.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

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

## 📦 Componentes

| Component | Descripción |
|---|---|
| `GliaChat` | Chat con agente IA (WebSocket) |
| `GliaCopilot` | Panel lateral de asistente |
| `GliaConversationList` | Historial de conversaciones |
| `GliaFileBrowser` | Workspace file browser |
| `GliaSkillEditor` | Editor de skills |

## 🪝 Hooks

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

## 🏗️ Arquitectura

```
soma/
├── lib/          # Backend Phoenix
├── server/       # Agent engines (Pi, ReAct, Hermes, Goose, OpenCode)
├── sdk/          # @zea/soma-sdk (React)
├── ui/           # Landing page de Soma
├── cli/          # CLI
└── skill/        # Skills para agentes
```

---

## 📄 Documentación

- [Integration Guide](./INTEGRATION_GUIDE.md)

## 📄 Licencia

Apache 2.0 — [ZEA Platform](https://github.com/zeacl)
