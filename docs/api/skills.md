# Skills API

---

## List skills

```
GET /api/skills
```

**Query params**:

| Param | Type | Default | Description |
|---|---|---|---|
| `agent_id` | UUID | — | Filter by agent |

**Response**:

```json
{
  "data": [
    {
      "id": "skill-uuid",
      "name": "fund-management",
      "content": "# Fund Management Skill\n\n...",
      "agent_id": "agent-uuid",
      "organization_id": "org-uuid"
    }
  ]
}
```

---

## Get skill

```
GET /api/skills/:name
```

**Response**: skill object with full content.

---

## Create skill

```
POST /api/skills
```

**Body**:

```json
{
  "name": "my-custom-skill",
  "content": "# My Skill\n\nInstructions for the agent...",
  "agent_id": "agent-uuid"
}
```

**Response**: `201 Created` with skill object.

---

## Update skill

```
PUT /api/skills/:name
```

**Body**:

```json
{
  "content": "# Updated Skill\n\nNew instructions..."
}
```

**Response**: `200 OK` with updated skill object.

---

## Delete skill

```
DELETE /api/skills/:name
```

**Response**: `200 OK` with `{"ok": true}`.

---

## Agent skill assignment

Skills are assigned to agents via Thalamus `agent_config.skillNames`. The Soma API provides CRUD for the skill content, but assignment is managed in Thalamus:

```
PUT thalamus:4000/api/agents/{uid}/config
{
  "skillNames": ["fund-management", "excel-analyzer", "my-custom-skill"]
}
```

When an agent initializes, Soma fetches this config from Thalamus and copies the matching skills to the agent's home directory.
