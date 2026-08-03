# Sandboxes API

---

## List sandbox files (unified)

```
GET /api/sandboxes?owner_type=agent&owner_id=<uuid>&path=
```

Lists files from any sandbox workspace. Org ID is taken from the authenticated JWT.

**Query params**:

| Param | Type | Required | Description |
|---|---|---|---|
| `owner_type` | `"user"` \| `"agent"` \| `"org"` | ✅ | Owner type |
| `owner_id` | UUID | ✅ | Owner ID |
| `path` | string | ❌ | Directory path |

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
    }
  ],
  "owner_type": "agent",
  "owner_id": "agent-uuid"
}
```

---

## Create sandbox

Creates an isolated Linux environment for an agent or user.

```
POST /api/sandboxes
```

**Body**:

```json
{
  "type": "agent",
  "user_id": "agent-uuid"
}
```

Or for a human user:

```json
{
  "type": "user",
  "user_id": "user-uuid"
}
```

Org ID is taken from the authenticated JWT, not the body.

Optional: `"teams": "team1,team2"` for group membership.

**Response**: `201 Created`

```json
{
  "ok": true,
  "username": "soma-a1b2c3d4e5f6",
  "uid": 1001,
  "home": "/home/soma-a1b2c3d4e5f6"
}
```

**What happens**:
1. Linux user created via `soma-agent-useradd` or `soma-user-useradd`
2. Home directory created at `/home/{soma,user}-{shortId}/`
3. Org shared workspace ensured (`/home/orgs/<id>/shared/`)
4. Permissions set to 700

### Alternative: GET create

```
GET /api/sandboxes/create?type=agent&user_id=<uuid>
```

Same behavior as POST, parameters as query string.

---

## Destroy sandbox

```
DELETE /api/sandboxes/:id?type=agent
```

**Query params**:

| Param | Type | Required | Description |
|---|---|---|---|
| `type` | `"agent"` \| `"user"` | ✅ | Sandbox type |

**Response**: `200 OK` with `{"ok": true}`.

**What happens**:
1. Linux user deleted via `soma-agent-userdel` or `soma-user-userdel`
2. Home directory removed (if not on persistent volume)
3. Agent/User removed from groups

---

## Delete file from sandbox (unified)

```
DELETE /api/sandboxes/delete?owner_type=agent&owner_id=<uuid>&path=old_file.txt
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

## Upload file to sandbox

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

---

## Sandbox lifecycle

```
Created on: agent/user registration (POST /api/agents or POST /api/sandboxes)
Destroyed on: agent/user deletion (DELETE /api/agents/:id or DELETE /api/sandboxes/:id)
Persisted: home directory on Docker volume /home
Restored: start.sh recreates Linux users from persistent homes
```
