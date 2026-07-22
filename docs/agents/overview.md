# Agents Overview

Agents are AI-powered assistants that run as isolated Linux users inside the Soma container. Each agent has its own home directory, skills, and pi sessions.

## Quick Start

### Create an agent

```bash
# Via CLI
zea-soma agent create --name "Code Reviewer" --skills "fund-management" --engine pi

# Via API
curl -X POST http://soma.zea.localhost/api/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Reviewer",
    "email": "reviewer@agents.zea.cl",
    "is_agent": true,
    "agent_config": {
      "engine": "pi",
      "model": "deepseek-v4-pro",
      "system_prompt": "You are a code reviewer...",
      "skills": ["fund-management"],
      "tools": ["read", "bash", "edit", "write"]
    }
  }'
```

### Chat with an agent

```tsx
// Via SDK
import { SomaChat } from '@zea.cl/soma-sdk'

<SomaChat
  agentId="full-stack-dev"
  apiKey="zs_live_..."
  baseUrl="https://soma.zea.cl"
/>
```

```bash
# Via CLI
zea-soma chat full-stack-dev
```

## Architecture

```
Agent Creation Flow:
  POST /api/agents
    → Thalamus: create user (is_agent: true)
    → Sandbox.create: Linux user + home dir
    → Copy skills to ~/.agents/skills/
    → Write pi config to ~/.pi/agent/config.json

Agent Chat Flow:
  WebSocket /agent-ws
    → AgentSocket (authenticate JWT)
    → AgentRunner.start_link (GenServer)
    → sudo -u soma-{id} pi --mode rpc
    → stdin/stdout JSONL
```

## Configuration

See [Agent Configuration](configuration.md) for full details on engines, models, skills, and sandbox isolation.

## Metrics

Agent activity is instrumented — see [Monitoring](../monitoring/overview.md) for the full metrics reference.
