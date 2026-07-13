# PostgreSQL — Base de Datos

- **URL**: `postgres:5432` (Docker network) / `localhost:5432` (host)
- **Auth**: usuario/contraseña vía `DATABASE_URL`
- **Base de datos**: `soma_prod`

## Schema

### Migración única: `20240613000000_create_core_tables.exs`

### Tablas

| Tabla | Columnas clave | Índices |
|---|---|---|
| `conversations` | id TEXT PK, user_id TEXT NOT NULL, title, last_message_at TIMESTAMPTZ, message_count INTEGER | — |
| `messages` | id UUID PK, conversation_id TEXT FK, role TEXT, content TEXT, thinking TEXT, tools JSONB, created_at TIMESTAMPTZ | `idx_messages_conv` |
| `api_keys` | id UUID PK, key_hash TEXT, organization_id UUID, name TEXT, created_by UUID | — |
| `skills` | id UUID PK, name TEXT, content TEXT, agent_id UUID, organization_id UUID | — |
| `agent_shares` | id UUID PK, agent_id UUID, shared_by UUID, shared_with UUID, organization_id UUID | UNIQUE(agent_id, shared_with) |

### Conexiones

- **Elixir API**: vía Ecto (`Soma.Repo`), pool size 3 (configurable con `POOL_SIZE`)
- **Pi Sidecar**: vía `pg` (Node.js), pool size 5, crea tablas conversations/messages si no existen

### Dual-write

⚠️ El Pi Sidecar escribe directamente en `conversations` y `messages` (sin pasar por la API Elixir). Esto crea un dual-write:
- Sidecar → PostgreSQL directo (mensajes en tiempo real)
- API Elixir → PostgreSQL vía Ecto (CRUD de conversaciones, skills, etc.)

Ambos comparten la misma BD pero usan conexiones separadas.

## Conectarse

```bash
# Directo
psql -h localhost -U postgres -d soma_prod

# Vía Docker
docker exec -it zea_postgres_local psql -U postgres -d soma_prod

# URL
DATABASE_URL="ecto://postgres:postgres_secure_password@postgres:5432/soma_prod"
```

## Limitaciones / Quirks

- Una sola migración monolítica — no hay sistema de versionado de migraciones
- El dual-write sidecar/Elixir puede causar inconsistencias si las tablas divergen
- Pool size 3 puede ser bajo para alta concurrencia
- No hay índices en `api_keys.key_hash` — los lookups por API key hacen full scan
