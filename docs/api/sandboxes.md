# Sandboxes API

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
  "user_id": "agent-uuid",
  "organization_id": "org-uuid"
}
```

Or for a human user:

```json
{
  "type": "user",
  "user_id": "user-uuid",
  "organization_id": "org-uuid"
}
```

**Response**:

```json
{
  "ok": true,
  "type": "agent",
  "username": "soma-agentuuid1",
  "home": "/home/soma-agentuuid1"
}
```

**What happens**:
1. Linux user created via `soma-agent-useradd` or `soma-user-useradd`
2. Home directory created at `/home/{soma,user}-{shortId}/`
3. For agents: skills copied to `~/.agents/skills/`
4. Workspace directory created at `~/workspace/`
5. Permissions set to 700

---

## Destroy sandbox

```
DELETE /api/sandboxes/:user_id
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

## Sandbox lifecycle

```
Created on: agent/user registration
Destroyed on: agent/user deletion
Persisted: home directory on Docker volume /home
Restored: start.sh recreates Linux users from persistent homes
```
