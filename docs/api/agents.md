# Agents API

---

## List agents

```
GET /api/agents
```

**Query params**:

| Param | Type | Default | Description |
|---|---|---|---|
| `organization_id` | UUID | — | Filter by org |

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

**Response**: agent object with config.

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
  "model": "deepseek-chat",
  "organization_id": "org-uuid"
}
```

**Response**: `201 Created` with agent object.

---

## Update agent

```
PUT /api/agents/:id
```

**Body** (partial):

```json
{
  "name": "Senior Code Reviewer",
  "is_active": true
}
```

**Response**: `200 OK` with updated agent.

---

## Delete agent

```
DELETE /api/agents/:id
```

**Response**: `200 OK` with `{"ok": true}`.

---

## Share agent

```
POST /api/agents/:id/share
```

**Body**:

```json
{
  "shared_with": "user-uuid"
}
```

**Response**: `201 Created` with `{"ok": true}`.

---

## Revoke share

```
DELETE /api/agents/:id/share
```

**Body**:

```json
{
  "shared_with": "user-uuid"
}
```

**Response**: `200 OK` with `{"ok": true}`.

---

## List shared agents

```
GET /api/agents/shared
```

Returns agents shared with the authenticated user.

---

## List shares for agent

```
GET /api/agents/:id/shares
```

Returns all shares for a specific agent.
