# Agent Sharing — Compartir agentes entre usuarios

- **Estado**: ✅ merged
- **Issues**: #e0f92f2

## Qué se hizo

Modelo de "agent shares" que permite compartir agentes entre usuarios de la misma organización. Un usuario GP admin puede compartir un agente con otros miembros de la org. Los shares se persisten en PostgreSQL y se validan contra Thalamus.

## Decisiones clave

- **Sharing por organización**: solo miembros de la misma org pueden recibir shares
- **Modelo en PostgreSQL**: tabla `agent_shares` con `agent_id`, `shared_by`, `shared_with`, `organization_id`
- **Validación vía Thalamus**: al listar agentes compartidos, se verifica que el receptor siga en la org

## API

```
POST   /api/agents/{id}/share     → compartir agente
DELETE /api/agents/{id}/share     → revocar share
GET    /api/agents/shared         → listar agentes compartidos conmigo
GET    /api/agents/{id}/shares    → listar shares de un agente
```

## Archivos modificados

- `lib/soma/agent_share.ex` — schema Ecto
- `lib/soma/agent_shares.ex` — lógica de negocio
- `lib/soma_web/controllers/api_controller.ex` — endpoints REST
- `priv/repo/migrations/20240613000000_create_core_tables.exs` — tabla agent_shares

## Errores encontrados

- **Usuario eliminado de la org → share huérfano**: no se limpia automáticamente. Workaround: el listado filtra shares inválidos al consultar Thalamus
- **Doble share**: si A comparte con B dos veces, solo existe un registro (unique constraint)
