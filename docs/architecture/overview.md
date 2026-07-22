# Architecture Overview

## High-Level Design

Soma is a **single-process Elixir application** running inside an Alpine Linux container. It handles REST API, WebSocket chat, sandboxed agent execution, and Prometheus metrics — all on port 4084.

```
                    ┌──────────────────────────┐
                    │     Caddy Reverse Proxy   │
                    │  soma.zea.localhost:80    │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │   Soma Container :4084    │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   SomaWeb.Endpoint   │  │
                    │  │   (Phoenix/Cowboy)   │  │
                    │  └─────────┬───────────┘  │
                    │            │              │
                    │  ┌─────────▼───────────┐  │
                    │  │     Router.ex        │  │
                    │  │  GET /health         │  │
                    │  │  GET /metrics        │  │
                    │  │  GET /agent-ws (WS)  │  │
                    │  │  /api/* → AuthRouter │  │
                    │  │  /* → index.html     │  │
                    │  └─────────┬───────────┘  │
                    │            │              │
                    │  ┌─────────▼───────────┐  │
                    │  │    Auth Plugs        │  │
                    │  │  JWTAuth → ApiKey   │  │
                    │  │  Auth → Guard        │  │
                    │  └─────────┬───────────┘  │
                    │            │              │
                    │  ┌─────────▼───────────┐  │
                    │  │   Controllers (7)    │  │
                    │  │  Conversation        │  │
                    │  │  File · Skill        │  │
                    │  │  Agent · Sandbox     │  │
                    │  │  ApiKey · Helpers    │  │
                    │  └─────────┬───────────┘  │
                    │            │              │
                    │  ┌─────────▼───────────┐  │
                    │  │    Business Logic     │  │
                    │  │  Skills · Workspace   │  │
                    │  │  Sandbox · AgentShare │  │
                    │  │  Conversations        │  │
                    │  └─────────┬───────────┘  │
                    │            │              │
                    │  ┌─────────▼───────────┐  │
                    │  │    AgentRunner       │  │
                    │  │  GenServer per agent │  │
                    │  │  sudo -u soma-{id}   │  │
                    │  │  pi --mode rpc       │  │
                    │  └─────────┬───────────┘  │
                    │            │              │
                    └────────────┼──────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │     Linux Kernel           │
                    │  /home/soma-{id}/          │
                    │  chmod 700 · user namespaces│
                    └───────────────────────────┘
```

## Key Design Decisions

### 1. Single Process, Multiple Responsibilities

Unlike the original design (which called for a separate Node.js sidecar), Soma handles everything in one Elixir process. This simplifies deployment and reduces failure modes.

### 2. Agents = Linux Users

Each agent is a real Linux user created via `useradd`. The kernel enforces isolation (chmod 700). No application-level path traversal checks needed.

### 3. pi as Subprocess, Not Service

The `pi` CLI runs as a subprocess per agent session (`sudo -u soma-{id} pi --mode rpc`), communicating via stdin/stdout JSONL. Not as a separate network service.

### 4. Dependency Injection for Testability

All infrastructure dependencies (Thalamus HTTP, shell commands, file system) are abstracted behind behaviours:
- `Soma.ThalamusClient` — HTTP calls to Thalamus
- `Soma.Shell` — System.cmd and Port.open
- `Soma.FileSystem` — File operations

In tests, these are replaced with mocks. In production, they use real implementations.

### 5. WebSocket Chat Protocol

The chat protocol is engine-agnostic. The client sends `{type: "init"|"prompt"|"cancel"}` and receives `{type: "ready"|"thinking"|"delta"|"tool"|"done"|"error"}`. The engine (pi) is abstracted behind JSONL stdin/stdout.

## Data Flow: Agent Chat

```
SDK (useSoma)                    Soma (Elixir)                    pi (subprocess)
     │                                │                                │
     │── WS connect /agent-ws ───────►│                                │
     │── {type:"init", uid, cid} ────►│                                │
     │                                │── AgentRunner.start_link       │
     │                                │── sudo -u soma-{id} pi ───────►│
     │◄── {type:"ready"} ────────────│◄── {:agent_event, "ready"} ────│
     │── {type:"prompt", text} ─────►│                                │
     │                                │── JSONL {type:"prompt"} ──────►│
     │                                │◄── JSONL {type:"thinking"} ───│
     │◄── {type:"thinking", text} ───│                                │
     │                                │◄── JSONL {type:"delta"} ──────│
     │◄── {type:"delta", text} ──────│                                │
     │                                │◄── JSONL {type:"done"} ───────│
     │◄── {type:"done"} ─────────────│                                │
```

## Tech Stack

| Layer | Technology |
|---|---|
| API Server | Elixir 1.18, Phoenix 1.8, Plug.Router, Cowboy 2 |
| Database | PostgreSQL 16 (Ecto) |
| AI Engine | pi CLI (`@earendil-works/pi-coding-agent`) via RPC mode |
| Metrics | PromEx 1.12 → Prometheus |
| Tracing | OpenTelemetry → Tempo |
| Logs | JSON stdout → Promtail → Loki |
| SDK | React 18/19, TypeScript, tsup |
| CLI | Node.js, Commander, Chalk |
| Container | Docker multi-stage, Alpine Linux 3.21 |

## Module Map

```
lib/soma/                        Business Logic
├── agent_runner.ex              pi subprocess manager (GenServer)
├── agent_metrics.ex             PromEx custom metrics
├── agent_share.ex               Agent sharing schema
├── skills.ex                    Skills CRUD + Thalamus sync
├── workspace.ex                 File workspace + Git
├── org_workspace.ex             Org shared workspace
├── sandbox.ex                   Agent sandbox (Linux users)
├── user_sandbox.ex              User sandbox (Linux users)
├── conversations.ex             Conversation management
├── conversation.ex              Conversation schema
├── message.ex                   Message schema
├── api_key.ex                   API key schema
├── application.ex               Supervisor
├── thalamus_client.ex           Thalamus HTTP behaviour
├── thalamus_client/real.ex      Thalamus HTTP via Req
├── shell.ex                     Shell command behaviour
├── shell/real.ex                System.cmd + Port.open
├── file_system.ex               File I/O behaviour
├── file_system/real.ex          File module wrapper
└── log_formatter.ex             JSON log formatter

lib/soma_web/                    Web Layer
├── endpoint.ex                  Phoenix Endpoint
├── router.ex                    Routes
├── tracing_plug.ex              OpenTelemetry spans
├── agent_socket.ex              WebSocket handler
├── controllers/
│   ├── agent_controller.ex      Agent CRUD + sharing
│   ├── conversation_controller.ex
│   ├── file_controller.ex
│   ├── skill_controller.ex
│   ├── sandbox_controller.ex
│   ├── api_key_controller.ex
│   └── helpers.ex
└── plugs/
    ├── auth_router.ex           Auth pipeline
    ├── jwt_auth.ex              JWT validation
    ├── api_key_auth.ex          API key validation
    └── guard.ex                 Auth guard
```
