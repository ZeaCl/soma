# Thalamus — Auth & Identity

- **URL**: `http://auth.zea.localhost` (local) / `https://auth.zea.cl` (prod)
- **Auth**: OAuth2 PKCE, JWT, Agent Tokens
- **Repositorio**: `/Users/dev/Documents/zea/thalamus`

## Endpoints que Soma consume

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/.well-known/jwks.json` | Validar JWT (JWKS) |
| `GET` | `/api/agents/{uid}/config` | Obtener agent_config (skills, system_prompt) |
| `POST` | `/oauth/token` | Exchange code/refresh por JWT |
| `POST` | `/oauth/introspect` | Validar token |

## JWT Claims relevantes

```json
{
  "sub": "user_uuid",
  "email": "c@zea.cl",
  "is_agent": false,
  "domain_roles": [
    {
      "org_id": "...",
      "domain": "fund_management",
      "role": "gp_admin",
      "scopes": ["funds:read", "funds:write"]
    }
  ],
  "scopes": ["funds:read", "funds:write"]
}
```

- `sub` → usado como `user_id` en conversaciones de Soma
- `is_agent` → si es true, es un agente (no un humano)
- `domain_roles` → autorización multi-tenant (canónico, usar esto sobre `scopes`)

## Agent Config

`GET /api/agents/{uid}/config` devuelve:

```json
{
  "skillNames": ["fund-management", "excel-analyzer"],
  "systemPrompt": "You are a fund management assistant...",
  "provider": "deepseek",
  "model": "deepseek-chat"
}
```

Soma usa `skillNames` para filtrar skills al preparar el sandbox. `systemPrompt` se pasa al bridge como `--system-prompt`.

## Auth en Soma

- **JWT Auth plug** (`lib/soma_web/plugs/jwt_auth.ex`): valida el JWT contra JWKS de Thalamus
- **API Key Auth plug** (`lib/soma_web/plugs/api_key_auth.ex`): fallback si no hay JWT
- El JWT se propaga al Pi Sidecar para WebSocket auth

## Limitaciones / Quirks

- Si Thalamus no responde al pedir `agent_config`, Soma usa fallback (`skillNames = []`, sin system prompt)
- El JWT debe incluir `domain_roles` para requests que requieren `org_id`
- Las seeds de Thalamus incluyen usuarios de prueba (ver `session-state.md`)
- CORS: Thalamus debe tener el dominio de Soma en `CORS_ORIGINS`
