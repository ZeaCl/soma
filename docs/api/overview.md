# REST API Overview

Base URL: `http://soma.zea.localhost` (local) / `https://soma.zea.cl` (prod)

---

## Authentication

All API endpoints require authentication via one of:

| Method | Header | Use case |
|---|---|---|
| JWT Bearer | `Authorization: Bearer <token>` | Web apps with OAuth2 login (Thalamus) |
| API Key | `x-api-key: zs_live_xxx` | Server-side, CI/CD, internal tools |

Health check endpoint is unauthenticated: `GET /health`

---

## Response Format

All responses are JSON:

```json
{
  "data": { ... },
  "ok": true
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

## Pagination

List endpoints support:

```
GET /api/conversations?page=1&per_page=20
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 142,
    "total_pages": 8
  }
}
```

---

## Rate Limits

- 100 requests per minute per API key
- 300 requests per minute per JWT
- WebSocket connections: 50 concurrent per agent

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
```

---

## Endpoints Summary

| Resource | Methods | Base Path |
|---|---|---|
| Conversations | GET, POST | `/api/conversations` |
| Messages | GET, POST | `/api/conversations/:id/messages` |
| Files | GET, POST, DELETE | `/api/files` |
| File Content | GET | `/api/files/content` |
| Unified Files | GET, POST | `/api/files/unified` |
| Skills | GET, POST, PUT, DELETE | `/api/skills` |
| Agents | GET, POST, PUT, DELETE | `/api/agents` |
| API Keys | GET, POST, DELETE | `/api/api-keys` |
| Sandboxes | POST, DELETE | `/api/sandboxes` |
| Agent Shares | POST, DELETE, GET | `/api/agents/:id/share` |
