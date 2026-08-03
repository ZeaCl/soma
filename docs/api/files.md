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
| `path` | string | `""` | Directory path |

**Response**:

```json
{
  "files": [
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

## Get file content

```
GET /api/files/content
```

**Query params**:

| Param | Type | Required | Description |
|---|---|---|---|
| `path` | string | ✅ | File path in workspace |

**Response**: file content as raw bytes with appropriate `Content-Type` (`.md` → `text/markdown`, `.json` → `application/json`, else `text/plain`).

Errors: `404` with `{"error": "not_found"}`.

---

## Upload file

```
POST /api/files/upload
```

**Body**:

```json
{
  "name": "data.xlsx",
  "data": "<base64_encoded_content>",
  "path": "excel/2026"
}
```

**Response**: `200 OK`

```json
{
  "ok": true,
  "path": "excel/2026/data.xlsx",
  "size": 24576
}
```

---

## Create directory

```
POST /api/files/mkdir
```

**Body**:

```json
{
  "path": "excel/2026"
}
```

**Response**: `200 OK` with `{"ok": true, "path": "excel/2026"}`.

Errors: `409` with `{"error": "Ya existe"}` if directory already exists.

---

## Rename file/directory

```
PUT /api/files/rename
```

**Body**:

```json
{
  "path": "excel/old_name.xlsx",
  "newName": "new_name.xlsx"
}
```

**Response**: `200 OK` with `{"ok": true, "path": "excel/new_name.xlsx"}`.

Errors: `404` with `{"error": "No encontrado"}`.

---

## Move file/directory

```
POST /api/files/move
```

**Body**:

```json
{
  "source": "excel/temp/report.xlsx",
  "dest": "excel/final/report.xlsx"
}
```

**Response**: `200 OK` with `{"ok": true, "path": "excel/final/report.xlsx"}`.

Errors: `404` with `{"error": "No encontrado"}`.

---

## Delete file/directory

```
DELETE /api/files?path=excel/old_report.xlsx
```

**Query params**:

| Param | Type | Required | Description |
|---|---|---|---|
| `path` | string | ✅ | File or directory path |

**Response**: `200 OK` with `{"ok": true}`.

Errors:
- `404` with `{"error": "No encontrado"}` — file not found
- `409` with `{"error": "Directorio no vacío"}` — directory not empty

---

## File version history

```
GET /api/files/history?path=excel/report.xlsx
```

**Query params**:

| Param | Type | Default | Description |
|---|---|---|---|
| `path` | string | `""` | File path |

**Response**:

```json
{
  "path": "excel/report.xlsx",
  "commits": [
    {
      "hash": "a1b2c3d",
      "message": "Updated report",
      "date": "2026-07-12T10:30:00Z"
    }
  ]
}
```

---

## Recover file version

```
POST /api/files/recover
```

**Body**:

```json
{
  "path": "excel/report.xlsx",
  "commit": "a1b2c3d"
}
```

**Response**: `200 OK` with `{"ok": true, "path": "excel/report.xlsx"}`.

---

## Push workspace changes

```
POST /api/files/push
```

Pushes workspace git changes to remote. **Response**: `200 OK` with `{"ok": true, "output": "..."}`.

---

## Trash (soft-delete)

### List trash

```
GET /api/files/trash
```

**Response**:

```json
{
  "files": [
    {
      "name": "deleted_report.xlsx",
      "path": ".trash/deleted_report.xlsx",
      "size": 245760,
      "type": "file",
      "modified_at": "2026-07-12T10:30:00Z"
    }
  ]
}
```

### Recover from trash

```
POST /api/files/trash/recover
```

**Body**:

```json
{
  "trash_filename": "deleted_report.xlsx",
  "target_path": "excel/recovered_report.xlsx"
}
```

**Response**: `200 OK` with `{"ok": true, "path": "excel/recovered_report.xlsx"}`.

---

## Unified file API

Unified endpoints work across user, agent, and org workspaces.

### List unified files

```
GET /api/files/unified?owner_type=agent&owner_id=<uuid>&path=
```

**Query params**:

| Param | Type | Required | Description |
|---|---|---|---|
| `owner_type` | `"user"` \| `"agent"` \| `"org"` | ✅ | Owner type |
| `owner_id` | UUID | ✅ | Owner ID (agent/user/org UUID) |
| `path` | string | ❌ | Directory path |

Org ID is taken from the authenticated JWT, not a query parameter.

**Response**: same format as `GET /api/files`.

### Upload unified file

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

**Response**: `200 OK` with `{"ok": true, "path": "excel/2026/data.xlsx", "size": 24576, "owner_type": "user", "owner_id": "user-uuid"}`.

### Delete unified file

```
DELETE /api/files/unified/delete?owner_type=agent&owner_id=<uuid>&path=old_file.txt
```

**Query params**:

| Param | Type | Required | Description |
|---|---|---|---|
| `owner_type` | `"user"` \| `"agent"` \| `"org"` | ✅ | Owner type |
| `owner_id` | UUID | ✅ | Owner ID |
| `path` | string | ✅ | File/directory path |

**Response**: `200 OK` with `{"ok": true}`.

Errors:
- `400` with `{"error": "owner_id required"}`
- `403` with `{"error": "forbidden"}` — path traversal attempt
- `404` with `{"error": "not_found"}`

---

## Sandbox upload (legacy)

```
POST /api/sandboxes/upload
```

**Body**:

```json
{
  "owner_type": "agent",
  "owner_id": "agent-uuid",
  "name": "file.txt",
  "data": "<base64_encoded_content>",
  "path": "subdir"
}
```

**Response**: `200 OK` with `{"ok": true, "path": "subdir/file.txt", "size": 1234, "owner_type": "agent", "owner_id": "agent-uuid"}`.
