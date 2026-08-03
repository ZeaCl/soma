# Conversations API

---

## List conversations

```
GET /api/conversations
```

Returns all conversations for the authenticated user in the org.

**Response**:

```json
{
  "data": [
    {
      "id": "conv-uuid",
      "title": "Q4 Analysis",
      "agent_id": "agent-uuid",
      "user_id": "user-uuid",
      "org_id": "org-uuid",
      "inserted_at": "2026-07-12T10:30:00Z",
      "updated_at": "2026-07-12T10:30:00Z"
    }
  ]
}
```

---

## Get conversation (with messages)

```
GET /api/conversations/:id
```

**Response**: conversation object with full message history:

```json
{
  "data": {
    "id": "conv-uuid",
    "title": "Q4 Analysis",
    "agent_id": "agent-uuid",
    "messages": [
      {
        "id": "msg-uuid",
        "role": "user",
        "content": "Analyze Q4 data",
        "created_at": "2026-07-12T10:30:00Z"
      },
      {
        "id": "msg-uuid2",
        "role": "assistant",
        "content": "Q4 revenue: $2.4M (+12% YoY)",
        "created_at": "2026-07-12T10:30:05Z"
      }
    ]
  }
}
```

Error: `404` with `{"error": "not_found"}`.

---

## Add message to conversation

```
POST /api/conversations/:id/messages
```

**Body**:

```json
{
  "role": "user",
  "content": "Can you explain this further?"
}
```

**Response**: `201 Created`

```json
{
  "data": {
    "id": "msg-uuid",
    "role": "user",
    "content": "Can you explain this further?",
    "conversation_id": "conv-uuid",
    "created_at": "2026-07-12T10:35:00Z"
  }
}
```

Error: `422` with `{"error": "validation_failed", "details": {...}}`.

---

## Delete conversation (soft-delete)

```
DELETE /api/conversations/:id
```

**Response**: `200 OK` with `{"ok": true}`.

Error: `404` with `{"error": "not_found"}`.
