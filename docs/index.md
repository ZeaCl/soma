# Soma Documentation

Soma is the **AgentHub** for ZEA Platform — multi-agent chat, sandboxed execution, skills, and workspaces. Use it to add AI agents to any React app with zero backend code.

---

## What are you trying to do?

| I want to... | Start here |
|---|---|
| 🟦 **Add AI chat to my React app** | [Getting Started → Dev](getting-started.md#-dev-integrating-soma-in-my-app) |
| 🤖 **Act as an AI agent / build agents** | [Agents Overview](agents/overview.md) |
| 🟢 **Deploy Soma on my own infra** | [Deployment](deployment/overview.md) |
| 🟣 **Administer agents, skills, workspaces** | [Getting Started → Admin](getting-started.md#-admin-manage-agents) |
| 🟡 **Understand the architecture** | [Architecture Overview](architecture/overview.md) |
| 📊 **Monitor Soma** | [Monitoring](monitoring/overview.md) |

---

## SDK — `@zea.cl/soma-sdk`

| Guide | Description |
|---|---|
| [React SDK](integrations/react-sdk.md) | Components, hooks, themes, auth |
| [WebSocket Protocol](integrations/websocket.md) | Agent chat protocol |
| [CLI Reference](cli/overview.md) | `zea-soma` command-line tool |

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

Skills are markdown files that teach AI agents how to use Soma and ZEA services.

| Skill | Description |
|---|---|
| [Soma Agents](../skill/SKILL.md) | Integrate Soma in React apps — SDK, auth, CLI, patterns |
| [User Sandbox](../skill/user-sandbox/SKILL.md) | Manage user sandboxes — files, uploads, shared workspaces |
| [Fund Management](../skill/fund-management/SKILL.md) | Fund management APIs — funds, investors, commitments |

---

## Architecture

```
Soma Container (Alpine Linux)
├── Elixir API (:4084)          REST + WebSocket + metrics
│   ├── Plug.Router             Conversations, files, skills, agents
│   ├── AgentSocket             WebSocket chat handler
│   ├── AgentRunner             pi --mode rpc subprocess manager
│   └── PromEx                  /metrics endpoint
│
├── Sandbox Layer (OS)
│   └── /home/{soma,user}-{id}/ Linux users with chmod 700
│       ├── workspace/          Agent/user files
│       ├── .agents/skills/     Agent skills (isolated)
│       └── .pi-sessions/       pi CLI sessions
│
└── Sidecar
    └── pi CLI                  AI engine (per-agent subprocess)
```

- [Full architecture overview](architecture/overview.md)

---

## Monitoring

| Guide | Description |
|---|---|
| [Overview](monitoring/overview.md) | Prometheus + Grafana + Loki + Tempo |
| [Metrics Reference](monitoring/metrics.md) | All Soma metrics (agents, BEAM, Ecto) |
| [Alerts](monitoring/alerts.md) | Alert rules and runbooks |
| [Dashboards](monitoring/dashboards.md) | AI Services, Services Health |

---

## Guides

| Guide | Description |
|---|---|
| [Deploy with Docker](deployment/overview.md) | Docker + docker-compose |
| [Configure Agents](agents/configuration.md) | Agent settings, engines, models |
| [Create Custom Skills](guides/custom-skills.md) | Write and deploy agent skills |
| [Setup CI/CD](guides/ci-cd.md) | GitHub Actions pipeline |
| [Troubleshooting](guides/troubleshooting.md) | Common issues and solutions |

---

## Reference

| Resource | Description |
|---|---|
| [README](../README.md) | Project overview and quick start |
| [Integration Guide](../INTEGRATION_GUIDE.md) | Step-by-step integration for React apps |
| [Isolation Plan](../PLAN-ISOLATION.md) | Sandbox security design |
| [CLI Reference](cli/overview.md) | zea-soma command reference |
