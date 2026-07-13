# Conversations API

---

## List conversations

```
GET /api/conversations
```

**Query params**:

| Param | Type | Default | Description |
|---|---|---|---|
| `agent_id` | UUID | — | Filter by agent |
| `user_id` | UUID | — | Filter by user |
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |

**Response**:

```json
{
  "data": [
    {
      "id": "conv_abc123",
      "user_id": "user_xyz",
      "title": "Q4 Analysis",
      "last_message_at": "2026-07-12T10:30:00Z",
      "message_count": 42,
      "created_at": "2026-07-10T08:00:00Z"
    }
  ]
}
```

---

## Create conversation

```
POST /api/conversations
```

**Body**:

```json
{
  "agent_id": "agent-uuid",
  "title": "Q4 Analysis"
}
```

**Response**: `201 Created` with conversation object.

---

## Get conversation

```
GET /api/conversations/:id
```

**Response**: conversation object with messages array.

---

## Delete conversation

```
DELETE /api/conversations/:id
```

**Response**: `200 OK` with `{"ok": true}`.

---

## List messages

```
GET /api/conversations/:id/messages
```

**Query params**:

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `per_page` | int | 50 | Items per page |
| `before` | UUID | — | Cursor: messages before this ID |

**Response**:

```json
{
  "data": [
    {
      "id": "msg-uuid",
      "conversation_id": "conv_abc123",
      "role": "user",
      "content": "Analyze Q4 data",
      "thinking": null,
      "tools": null,
      "created_at": "2026-07-12T10:30:00Z"
    },
    {
      "id": "msg-uuid2",
      "role": "assistant",
      "content": "Q4 revenue: $2.4M (+12% YoY)",
      "thinking": "Analyzing revenue trends...",
      "tools": [
        {
          "name": "read_file",
          "input": {"path": "data/q4.csv"},
          "result": "revenue,2400000\n..."
        }
      ],
      "created_at": "2026-07-12T10:30:05Z"
    }
  ]
}
```
