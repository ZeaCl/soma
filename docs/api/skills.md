# Skills API

---

## List skills

```
GET /api/skills
```

Lists all skills for the authenticated org (from JWT). Includes both custom skills stored in the DB and built-in skills from the filesystem.

**Response**:

```json
{
  "data": [
    {
      "id": "skill-uuid",
      "name": "fund-management",
      "content": "# Fund Management Skill\n\n...",
      "organization_id": "org-uuid",
      "custom": true
    }
  ],
  "total": 5
}
```

---

## Get skill

```
GET /api/skills/:name
```

**Response**: skill object with full content and source indicator:

```json
{
  "name": "fund-management",
  "content": "# Fund Management Skill\n\n...",
  "source": "db"
}
```

`source` is `"db"` for custom skills, `"builtin"` for built-in skills.

Error: `404` with `{"error": "not_found"}`.

---

## Create skill

```
POST /api/skills
```

**Body**:

```json
{
  "name": "my-custom-skill",
  "content": "# My Skill\n\nInstructions for the agent..."
}
```

Org ID is taken from the authenticated JWT. This is an upsert — if the skill name already exists, it updates the content.

**Response**: `201 Created`

```json
{
  "data": {
    "id": "skill-uuid",
    "name": "my-custom-skill",
    "content": "# My Skill\n\n...",
    "organization_id": "org-uuid"
  }
}
```

Error: `422` with `{"error": "validation_failed", "details": {...}}`.

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

**Response**: `200 OK`

```json
{
  "data": {
    "id": "skill-uuid",
    "name": "my-custom-skill",
    "content": "# Updated Skill\n\n..."
  }
}
```

---

## Delete skill

```
DELETE /api/skills/:name
```

**Response**: `204 No Content`.

Error: `404` with `{"error": "not_found"}`.

---

## Assign skill to agents

```
PUT /api/skills/:name/agents
```

Assigns a skill to one or more agents by updating their agent config in Thalamus.

**Body**:

```json
{
  "agentIds": ["agent-uuid-1", "agent-uuid-2"]
}
```

**Response**: `200 OK` with assignment result.

---

## Agent skill assignment

Skills are assigned to agents via Thalamus `agent_config.skills`. The Soma API provides CRUD for the skill content, but the assignment links are managed via `PUT /api/skills/:name/agents` or directly in Thalamus:

```
PUT thalamus:4000/api/agents/{uid}/config
{
  "skills": ["fund-management", "excel-analyzer"]
}
```

When an agent initializes, Soma fetches this config from Thalamus and copies the matching skills to the agent's home directory (`~/skills/`).
