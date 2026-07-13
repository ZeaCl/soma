# User Workspace — Sandboxes Humanos

- **Estado**: ✅ merged
- **Issues**: #7bcc2d6

## Qué se hizo

Extensión del modelo de sandbox para usuarios humanos (no agentes). Misma arquitectura de aislamiento Linux pero sin ejecución de `pi`. Los usuarios suben archivos (Excel, CSV, PDF) a su workspace personal vía SDK o API REST.

## Decisiones clave

- **Mismo mecanismo que agentes**: `user-useradd`/`user-userdel` análogos a los de agentes, home en `/home/user-{shortId}/`
- **Sin `.agents/skills/`**: los usuarios no ejecutan `pi`, no necesitan skills
- **Workspace compartido por org**: `/workspace/orgs/{orgId}/shared/` con `setgid` bit para herencia de grupo
- **SDK dedicado**: `UserWorkspace`, `UserFileDropZone`, `useUserWorkspace`

## API REST

```
POST   /api/sandboxes              → crear/destruir sandbox
GET    /api/files/unified           → listar archivos (owner_type, owner_id)
POST   /api/files/unified/upload    → subir archivo (base64)
GET    /api/files/content           → leer archivo
```

## Archivos modificados

- `scripts/soma-user-useradd` — creación de usuario Linux humano
- `scripts/soma-user-userdel` — destrucción
- `server/user-sandbox.ts` — `prepareUser()`, `destroyUser()`
- `sdk/src/components/UserWorkspace.tsx` — componente React
- `sdk/src/components/UserFileDropZone.tsx` — drag-and-drop upload
- `lib/soma/user_sandbox.ex` — lógica Elixir
- `lib/soma/org_workspace.ex` — workspace compartido

## Errores encontrados

- **Grupo de org no existe en primer deploy**: `start.sh` crea grupo default `org-00000000-...` como fallback
- **Permisos setgid no heredados en todos los FS**: verificar con `ls -la` después de crear shared/
