# Agent Configuration

## Overview

Agents in Soma are AI-powered assistants that run as isolated Linux users. Each agent has a configuration that determines its behavior: engine, model, skills, tools, and system prompt.

## Agent Lifecycle

```
1. Create agent (POST /api/agents)
   └─ Thalamus registers the user with is_agent: true
   └─ Sandbox.create provisions Linux user + home dir
   └─ Skills are copied to ~/.agents/skills/
   └─ pi config written to ~/.pi/agent/config.json

2. Chat session (WebSocket /agent-ws)
   └─ AgentSocket authenticates JWT token
   └─ AgentRunner.start_link spawns GenServer
   └─ sudo -u soma-{id} pi --mode rpc
   └─ stdin/stdout JSONL protocol

3. Agent stops
   └─ WebSocket disconnect → AgentRunner terminates
   └─ Port closed → pi process killed
   └─ Conversation saved to PostgreSQL
```

## Configuration Options

```json
{
  "engine": "pi",
  "model": "deepseek-v4-pro",
  "system_prompt": "You are a helpful assistant...",
  "skills": ["fund-management", "xlsx"],
  "tools": ["read", "bash", "edit", "write"],
  "workspace_paths": ["/workspace/orgs/{orgId}/shared"]
}
```

| Field | Description | Default |
|---|---|---|
| `engine` | AI engine: `pi`, `react`, `opencode` | `pi` |
| `model` | LLM model name | (provider default) |
| `system_prompt` | Initial system prompt | (none) |
| `skills` | Skill names to load | `[]` |
| `tools` | Allowed tools | `["read","bash","edit","write"]` |
| `workspace_paths` | Additional mount paths | `[]` |

## Engines

| Engine | Description | Status |
|---|---|---|
| **pi** | `@earendil-works/pi-coding-agent` via RPC mode | ✅ Active |
| react | LangChain/LangGraph (planned) | ⬜ Planned |
| opencode | opencode CLI (planned) | ⬜ Planned |
| hermes | Hermes agent (planned) | ⬜ Planned |

## Sandbox Isolation

Each agent runs as a real Linux user:

```
/home/soma-{first12chars}/
├── workspace/              ← Private work directory
├── .pi/agent/
│   ├── config.json         ← Engine + model + skills
│   ├── settings.json       ← pi settings (provider, theme)
│   └── auth.json           ← API keys
├── .pi-sessions/           ← pi session persistence
├── .agents/skills/         ← Skill files (SKILL.md each)
└── shared/ → /workspace/orgs/{orgId}/shared/  ← bind mount
```

## Custom Skills

Skills are Markdown files that instruct the agent how to use specific APIs or services. They live in:
- `/root/.agents/skills/` — builtin skills (container image)
- `/app/.pi-agent-skills/` — custom skills (per-org, DB-backed)

### Skill Structure

```markdown
---
name: my-skill
description: What this skill does
---

# My Skill

Instructions for the agent...

## API Endpoints

curl examples...
```

## Metrics

Agent activity is instrumented with PromEx:

| Metric | Type | Description |
|---|---|---|
| `soma_agent_sessions_total` | Counter | Sessions started |
| `soma_agent_requests_total` | Counter | Prompts sent |
| `soma_agent_response_duration_milliseconds` | Histogram | Response latency |
| `soma_agent_errors_total` | Counter | Errors by type |
| `soma_agent_tool_calls_total` | Counter | Tool calls by name |
| `soma_agent_thinking_duration_milliseconds` | Histogram | Thinking time |
