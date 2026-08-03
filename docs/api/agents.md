# Agents API

---

## List agents

```
GET /api/agents
```

Returns agents for the authenticated org (from JWT).

**Response**:

```json
{
  "data": [
    {
      "id": "agent-uuid",
      "name": "Full Stack Developer",
      "type": "autonomous",
      "provider": "deepseek",
      "model": "deepseek-chat",
      "organization_id": "org-uuid",
      "is_active": true,
      "created_at": "2026-06-24T00:00:00Z"
    }
  ]
}
```

---

## Get agent

```
GET /api/agents/:id
```

**Response**: agent object with full config from Thalamus.

Error: `404` with `{"error": "not_found"}`.

---

## Create agent

```
POST /api/agents
```

**Body**:

```json
{
  "name": "Code Reviewer",
  "type": "autonomous",
  "provider": "deepseek",
  "model": "deepseek-chat"
}
```

Org ID is taken from the authenticated JWT.

**Response**: `201 Created` with agent object. Also triggers async sandbox creation (Linux user + home + skills copy).

Error: `422` with `{"error": "..."}`.

---

## Update agent config

```
PUT /api/agents/:id/config
```

Updates the agent's configuration in Thalamus (name, provider, model, skills, system prompt, etc.).

**Body** (partial):

```json
{
  "name": "Senior Code Reviewer",
  "is_active": true
}
```

**Response**: `200 OK`

```json
{
  "ok": true,
  "config": { ... }
}
```

---

## Delete agent

```
DELETE /api/agents/:id
```

**Response**: `200 OK` with `{"ok": true}`.

Error: `404` with `{"error": "not_found"}`.

---

## Get agent skills

```
GET /api/agents/:id/skills
```

Returns the resolved skill content for all skills assigned to the agent.

**Response**:

```json
{
  "data": [
    {
      "name": "fund-management",
      "content": "# Fund Management Skill\n\n..."
    }
  ]
}
```

Error: `404` with `{"error": "not_found"}` (agent not found).

---

## Share agent

```
POST /api/agents/:id/share
```

**Body**:

```json
{
  "shared_with_user_id": "user-uuid"
}
```

**Response**: `200 OK` with `{"ok": true}`.

Error: `422` with `{"error": "validation_failed", "details": {...}}`.

---

## Revoke share

```
DELETE /api/agents/:id/share/:user_id
```

`:user_id` is the UUID of the user to unshare with.

**Response**: `200 OK` with `{"ok": true}`.

Error: `404` with `{"error": "not_found"}`.

---

## List shares for agent

```
GET /api/agents/:id/shares
```

Returns all shares for a specific agent.

**Response**:

```json
{
  "data": [
    {
      "agent_id": "agent-uuid",
      "shared_with_user_id": "user-uuid",
      "shared_by_user_id": "admin-uuid"
    }
  ]
}
```

---

## List agents shared with me

```
GET /api/agents/shared
```

Returns agents shared with the authenticated user.

**Response**: same format as `GET /api/agents`.

---

## List all agent shares

```
GET /api/agent-shares
```

Returns all shares in the org.

**Response**:

```json
{
  "data": [
    {
      "agent_id": "agent-uuid",
      "shared_with_user_id": "user-uuid",
      "shared_by_user_id": "admin-uuid"
    }
  ]
}
```
