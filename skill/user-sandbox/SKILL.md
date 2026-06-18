---
name: user-sandbox
description: "Gestionar sandboxes de usuarios humanos en Soma. Crear, listar, subir archivos (Excel, CSV, Python), leer workspace. Usar cuando se necesita gestionar archivos de usuarios o crear workspaces aislados."
---

# User Sandbox — Soma

## 🎯 What it does

Cada usuario humano tiene un sandbox aislado en Soma:
- Home: `/home/user-{shortId}/`
- Workspace: `~/workspace/` (archivos personales: Excel, CSV, Python, etc.)
- Shared: `/workspace/orgs/{orgId}/shared/` (compartido con la org)

Los permisos son enforced por Linux (chmod 700 en home, grupos para shared).

## 📡 API REST

```bash
# ── Sandbox Lifecycle ──

# Crear sandbox para un usuario
curl -X POST http://soma:4084/api/sandboxes \
  -H "Authorization: Bearer ${ZEA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"type": "user", "user_id": "user_uuid_123"}'
# → {"ok":true,"type":"user","username":"user-user_uuid_1","home":"/home/user-user_uuid_1"}

# Destruir sandbox
curl -X DELETE "http://soma:4084/api/sandboxes/user_uuid_123?type=user" \
  -H "Authorization: Bearer ${ZEA_TOKEN}"

# ── File Operations ──

# Listar archivos del workspace de un usuario
curl "http://soma:4084/api/files/unified?owner_type=user&owner_id=user_uuid_123" \
  -H "Authorization: Bearer ${ZEA_TOKEN}"

# Listar con subdirectorio
curl "http://soma:4084/api/files/unified?owner_type=user&owner_id=user_uuid_123&path=excel" \
  -H "Authorization: Bearer ${ZEA_TOKEN}"

# Subir archivo (base64)
curl -X POST http://soma:4084/api/files/unified/upload \
  -H "Authorization: Bearer ${ZEA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "owner_type": "user",
    "owner_id": "user_uuid_123",
    "name": "Llamados_Registro.xlsx",
    "data": "<base64_encoded_content>",
    "path": "excel/2026"
  }'

# Leer archivo
curl "http://soma:4084/api/files/content?path=excel/2026/Llamados_Registro.xlsx" \
  -H "Authorization: Bearer ${ZEA_TOKEN}"

# ── Shared Org Workspace ──

# Listar archivos compartidos de la org
curl "http://soma:4084/api/files/unified?owner_type=org&owner_id=&org_id=org_uuid" \
  -H "Authorization: Bearer ${ZEA_TOKEN}"

# Subir archivo a la org compartida
curl -X POST http://soma:4084/api/files/unified/upload \
  -H "Authorization: Bearer ${ZEA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "owner_type": "org",
    "owner_id": "org_uuid",
    "name": "reporte_mensual.xlsx",
    "data": "<base64>"
  }'
```

## 🖥️ CLI (soma)

```bash
# Crear sandbox de usuario
soma user-sandbox create <user-id> --org <org-id>

# Destruir sandbox
soma user-sandbox destroy <user-id>

# Listar archivos de un usuario
soma user-sandbox files <user-id> [--path <subpath>]

# Subir archivo
soma user-sandbox upload <user-id> <local-file> [--path <remote-dir>]

# Listar archivos compartidos de la org
soma org-workspace list <org-id>
```

## 🧩 SDK Components (React)

```tsx
import { UserWorkspace, useUserWorkspace } from '@zea/soma-sdk'

// Componente completo (igual de fácil que GliaChat)
<UserWorkspace
  ownerType="user"
  ownerId="user_uuid_123"
  baseUrl="http://soma.zea.localhost"
  authHeaders={() => ({ Authorization: `Bearer ${token}` })}
/>
```

## 🔒 Permisos Linux

| Recurso | Permisos | Grupo |
|---------|----------|-------|
| `/home/user-{id}/` | 700 | user-{id} |
| `/home/user-{id}/workspace/` | 700 | user-{id} |
| `/workspace/orgs/{org}/shared/` | 2770 | org-{org} |

El setgid bit (g+s) en shared/ asegura que archivos nuevos hereden el grupo.

## 🔄 Flujo típico

```
1. Thalamus crea usuario → notifica a Soma
2. Soma: POST /api/sandboxes {type:"user", user_id:"..."}
3. Soma crea usuario Linux user-{shortId}
4. Usuario sube archivos vía SDK <UserWorkspace>
5. Archivos quedan en /home/user-{shortId}/workspace/
6. Para compartir: copiar/mover a /workspace/orgs/{org}/shared/
7. Otros miembros de la org (mismo grupo Linux) pueden acceder
```
