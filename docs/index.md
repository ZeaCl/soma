# Soma Documentation

Soma is the **AgentHub** for ZEA Platform — multi-agent chat, sandboxed execution, skills, and workspaces. Use it to add AI agents to any React app with zero backend code.

---

## What are you trying to do?

| I want to... | Start here |
|---|---|
| 🟦 **Add AI chat to my React app** | [Getting Started → Dev](getting-started.md#-dev-integrating-soma-in-my-app) |
| 🤖 **Act as an AI agent / build agents** | [Skills for Agents](../skill/SKILL.md) |
| 🟢 **Deploy Soma on my own infra** | [Getting Started → DevOps](getting-started.md#-devops-deploy-on-prem) |
| 🟣 **Administer agents, skills, workspaces** | [Getting Started → Admin](getting-started.md#-admin-manage-agents) |
| 🟡 **Understand the architecture** | [Architecture Overview](#architecture) |

---

## SDK — @zea.cl/soma-sdk

| Guide | Description |
|---|---|
| [React SDK](integrations/react-sdk.md) | Components, hooks, themes, auth — full integration guide |
| [CLI Reference](integrations/cli.md) | Command-line tools for agent & workspace management |

---

## API Reference

| Guide | Endpoints |
|---|---|
| [Overview](api/overview.md) | Auth headers, pagination, response format |
| [Conversations](api/conversations.md) | CRUD conversations and messages |
| [Files](api/files.md) | Upload, download, list workspace files |
| [Skills](api/skills.md) | CRUD skills, assign to agents |
| [Agents](api/agents.md) | CRUD agents, configuration, sharing |
| [Sandboxes](api/sandboxes.md) | Create/destroy agent and user sandboxes |

---

## Agent Skills

Skills are markdown files that teach AI agents how to use Soma. Agents read these at runtime.

| Skill | Description |
|---|---|
| [Soma Agents](../skill/SKILL.md) | Integrate Soma in React apps — SDK, auth, CLI, patterns |
| [User Sandbox](../skill/user-sandbox/SKILL.md) | Manage user sandboxes — files, uploads, shared workspaces |

---

## Architecture

```
Soma Container (Alpine Linux)
├── Pi Sidecar (:3002)          WebSocket agents + HTTP API
│   ├── agent-rpc.ts            Orchestrator (init → sandbox → bridge → prompt)
│   ├── agent-sandbox.ts        Linux user lifecycle (useradd/userdel)
│   └── rpc-bridge.ts           stdin/stdout JSONL ↔ pi --mode rpc
│
├── Elixir API (:4084)          REST API
│   └── Phoenix Plug.Router     Conversations, files, skills, agents
│
└── Sandbox Layer (OS)
    └── /home/{soma,user}-{id}/ Linux users with chmod 700
        ├── workspace/          Agent/user files
        ├── .agents/skills/     Agent skills (isolated)
        └── .pi-sessions/       pi CLI sessions
```

- [Full architecture overview](architecture.md) (coming soon)

---

## Reference

| Resource | Description |
|---|---|
| [README](../README.md) | Project overview and quick start |
| [Integration Guide](../INTEGRATION_GUIDE.md) | Step-by-step integration for React apps |
| [Isolation Plan](../PLAN-ISOLATION.md) | Sandbox security design |
| [OpenAPI Spec](OPENAPI_SPEC.yaml) | Full API specification (coming soon) |
