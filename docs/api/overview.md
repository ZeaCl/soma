# REST API Overview

Base URL: `http://soma.zea.localhost` (local) / `https://soma.zea.cl` (prod)

---

## Authentication

All API endpoints require authentication via one of:

| Method | Header | Use case |
|---|---|---|
| JWT Bearer | `Authorization: Bearer <token>` | Web apps with OAuth2 login (Thalamus) |
| API Key | `x-api-key: zs_live_xxx` | Server-side, CI/CD, internal tools |

Authentication chain: `JWTAuth` → `ApiKeyAuth` → `Guard` (org isolation).

The org ID is extracted from the JWT claims or API key metadata — it is **not** passed as a body or query parameter.

Health check and metrics endpoints are unauthenticated:
- `GET /health` → `{"status": "ok", "service": "soma"}`
- `GET /metrics` → Prometheus text format

---

## Response Format

All responses are JSON. Two common patterns:

Success with data wrapper:
```json
{
  "data": { ... }
}
```

Success flat:
```json
{
  "ok": true,
  "path": "excel/report.xlsx"
}
```

Errors:
```json
{
  "error": "not_found",
  "message": "Conversation not found"
}
```

---

## Endpoints Summary

| Resource | Methods | Base Path |
|---|---|---|
| Conversations | GET, POST, DELETE | `/api/conversations` |
| Files | GET, POST, PUT, DELETE | `/api/files` |
| File Trash | GET, POST | `/api/files/trash` |
| File History | GET, POST | `/api/files/history` |
| Unified Files | GET, POST, DELETE | `/api/files/unified` |
| Skills | GET, POST, PUT, DELETE | `/api/skills` |
| Agents | GET, POST, PUT, DELETE | `/api/agents` |
| Agent Shares | POST, DELETE, GET | `/api/agents/:id/share`, `/api/agents/shared` |
| API Keys | GET, POST, DELETE | `/api/api-keys` |
| Sandboxes | GET, POST, DELETE | `/api/sandboxes` |
| WebSocket | — | `/agent-ws` |

### File endpoints detail

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/files` | List files (`?agent_id=&path=`) |
| `GET` | `/api/files/content` | Get file content (`?path=`) |
| `POST` | `/api/files/upload` | Upload file (base64 body) |
| `POST` | `/api/files/mkdir` | Create directory |
| `PUT` | `/api/files/rename` | Rename file/directory |
| `POST` | `/api/files/move` | Move file/directory |
| `DELETE` | `/api/files` | Delete file/directory (`?path=`) |
| `GET` | `/api/files/history` | File version history (`?path=`) |
| `POST` | `/api/files/recover` | Recover file version |
| `POST` | `/api/files/push` | Push workspace to remote |
| `GET` | `/api/files/trash` | List soft-deleted files |
| `POST` | `/api/files/trash/recover` | Recover from trash |
| `GET` | `/api/files/unified` | List files across owners (`?owner_type=&owner_id=`) |
| `POST` | `/api/files/unified/upload` | Upload to any owner workspace |
| `DELETE` | `/api/files/unified/delete` | Delete from any owner workspace (`?owner_type=&owner_id=&path=`) |

### Sandbox endpoints detail

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sandboxes` | List sandbox files (`?owner_type=&owner_id=`) |
| `POST` | `/api/sandboxes` | Create sandbox |
| `GET` | `/api/sandboxes/create` | Create sandbox (GET alternative) |
| `DELETE` | `/api/sandboxes/:id` | Destroy sandbox (`?type=user\|agent`) |
| `POST` | `/api/sandboxes/upload` | Upload file to sandbox |
| `DELETE` | `/api/sandboxes/delete` | Delete file from sandbox (`?owner_type=&owner_id=&path=`) |

### Agent endpoints detail

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/agents` | List agents |
| `POST` | `/api/agents` | Create agent (+ sandbox async) |
| `GET` | `/api/agents/:id` | Get agent |
| `PUT` | `/api/agents/:id/config` | Update agent config |
| `DELETE` | `/api/agents/:id` | Delete agent |
| `GET` | `/api/agents/:id/skills` | Get agent's resolved skills |
| `POST` | `/api/agents/:id/share` | Share agent with user |
| `DELETE` | `/api/agents/:id/share/:user_id` | Revoke share |
| `GET` | `/api/agents/:id/shares` | List shares for agent |
| `GET` | `/api/agents/shared` | List agents shared with me |
| `GET` | `/api/agent-shares` | List all shares in org |
