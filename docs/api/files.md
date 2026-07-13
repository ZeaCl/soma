# Files API

---

## List files

```
GET /api/files
```

**Query params**:

| Param | Type | Default | Description |
|---|---|---|---|
| `agent_id` | UUID | — | Filter by agent |
| `path` | string | `"/"` | Directory path |

**Response**:

```json
{
  "data": [
    {
      "name": "report.xlsx",
      "path": "/excel/report.xlsx",
      "size": 245760,
      "type": "file",
      "modified_at": "2026-07-12T10:30:00Z"
    },
    {
      "name": "excel",
      "path": "/excel",
      "size": 0,
      "type": "directory",
      "modified_at": "2026-07-10T08:00:00Z"
    }
  ]
}
```

---

## Unified file listing (user + agent + org)

```
GET /api/files/unified
```

**Query params**:

| Param | Type | Required | Description |
|---|---|---|---|
| `owner_type` | `"user"` \| `"agent"` \| `"org"` | ✅ | Owner type |
| `owner_id` | UUID | ✅ | Owner ID |
| `org_id` | UUID | ❌ | Org ID (for `"org"` type only) |
| `path` | string | ❌ | Directory path |

---

## Upload file

```
POST /api/files/unified/upload
```

**Body**:

```json
{
  "owner_type": "user",
  "owner_id": "user-uuid",
  "name": "data.xlsx",
  "data": "<base64_encoded_content>",
  "path": "excel/2026"
}
```

**Response**: `201 Created` with `{"ok": true, "path": "excel/2026/data.xlsx"}`.

---

## Get file content

```
GET /api/files/content
```

**Query params**:

| Param | Type | Required | Description |
|---|---|---|---|
| `path` | string | ✅ | File path in workspace |

**Response**: file content as raw bytes with appropriate `Content-Type`.

---

## Delete file

```
DELETE /api/files
```

**Body**:

```json
{
  "path": "excel/old_report.xlsx"
}
```

**Response**: `200 OK` with `{"ok": true}`.

---

## Legacy upload

```
POST /api/upload
```

Multipart form upload. Same as unified upload but uses `FormData`.

```
POST /api/upload
Content-Type: multipart/form-data

agent_id: "agent-uuid"
file: <binary>
```
