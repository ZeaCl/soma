# Reglas y Patrones — Soma AgentHub

Patrones descubiertos desarrollando Soma. Si algo se repite 3 veces, documentarlo acá.

---

## Sandbox: Aislamiento de agentes (Linux users)

### Creación de sandbox

- Cada agente es un **usuario Linux real**: `soma-{first12chars del UUID}`
- Home: `/home/soma-{shortId}/` con `chmod 700`
- Se crea vía `soma-agent-useradd` (bash script en `/usr/local/bin/`)
- El script crea usuario + grupo + home + subdirectorios
- **No usar `useradd` directamente** — usar el script que ya maneja edge cases

### Skills isolation

- Skills se copian a `~/.agents/skills/` desde `/root/.agents/skills/`
- **Solo las skills asignadas** al agente (filtradas por Thalamus agent_config)
- El agente NO puede ver skills de otros agentes (home aislado)
- Si `skillNames` es `nil` o vacío → no copiar nada (fix: `c70491c`)

### Persistencia entre deploys

- El volumen `/home` persiste entre reinicios del contenedor
- Pero los usuarios Linux NO persisten (se pierden al recrear el container)
- `start.sh` hace bootstrap: recorre `/home/soma-*/` y recrea usuarios con `useradd`
- También recrea usuarios humanos desde `/home/user-*/`
- Los archivos de `/etc/passwd`, `/etc/group`, `/etc/shadow` se respaldan en `.default`

### Permisos

| Recurso | Permisos | Owner |
|---------|----------|-------|
| `/home/soma-{id}/` | 700 | soma-{id}:soma-{id} |
| `~/workspace/` | 700 | soma-{id}:soma-{id} |
| `/workspace/orgs/{org}/shared/` | 2770 | root:org-{org} |
| `/home/user-{id}/` | 700 | user-{id}:user-{id} |

---

## RPC Bridge: stdin/stdout JSONL con pi

### Formato del protocolo

- `pi --mode rpc --session-dir /home/soma-{id}/.pi-sessions`
- Entrada (stdin): líneas JSONL con `{ type, payload }`
- Salida (stdout): líneas JSONL con `{ type, content?, tool_name?, tool_input? }`

### Tipos de mensajes

| type (in) | payload | Descripción |
|---|---|---|
| `init` | `{ systemPrompt?, provider?, model? }` | Inicializar sesión |
| `prompt` | `{ text: string }` | Enviar mensaje del usuario |
| `cancel` | `{}` | Cancelar generación en curso |

| type (out) | content? | Descripción |
|---|---|---|
| `text` | ✅ | Fragmento de respuesta |
| `thinking` | ✅ | Pensamiento del modelo |
| `tool_call` | ❌ | tool_name + tool_input |
| `tool_result` | ✅ | Resultado de tool |
| `done` | ❌ | Generación completada |
| `error` | ✅ | Error |

### Ejecución

- **Siempre con `sudo -u soma-{id}`** — nunca con uid/gid directo (fix: `406539a`)
- Las API keys se pasan explícitamente porque `sudo` limpia el entorno:
  ```bash
  DEEPSEEK_API_KEY=sk-xxx HOME=/home/soma-abc123 pi --mode rpc --session-dir /home/soma-abc123/.pi-sessions
  ```
- El bridge se comunica por `EventEmitter`: `text`, `thinking`, `tool_call`, `tool_result`, `done`, `error`

### Manejo de errores

- Si `pi` no está instalado → el bridge emite `error` y `start.sh` lo advierte en bootstrap
- Si el proceso muere → `agent-rpc.ts` reinicia el sidecar entero (no solo el bridge)
- Timeout de prompt → el cliente puede enviar `cancel`

---

## Skills: sistema de archivos + Thalamus

### Fuentes de skills

1. **Built-in**: `/root/.agents/skills/` — skills pre-instaladas en el contenedor
2. **Custom**: `/app/.pi-agent-skills/` — skills creadas por usuarios vía API
3. **Thalamus agent_config**: define qué skills tiene cada agente

### Flujo de carga

```
1. Cliente WebSocket → { type: "init", uid, cid }
2. agent-rpc.ts → GET thalamus:4000/api/agents/{uid}/config
3. Extrae skillNames del agent_config
4. prepareAgent(uid, skillNames) → copia skills al home
5. pi --mode rpc → lee ~/.agents/skills/
```

### Reglas

- Skills son archivos `.md` con frontmatter YAML (name, description)
- El nombre del archivo NO importa — el `name` en el frontmatter es el canónico
- Si Thalamus no responde → `skillNames = []` (no crashea, solo sin skills)
- Cambios en skills requieren reiniciar el bridge (nuevo `init`)

---

## SDK React: @zea.cl/soma-sdk

### Convenciones de componentes

- Todos los componentes son `'use client'` (client components)
- Props de colores usan interfaz parcial (`Partial<GliaChatColors>`)
- CSS via CSS variables en `:root` o via prop `colors`
- Sin dependencias externas de UI — todo inline styles + CSS
- Base URL default: sin default, el integrador debe pasarlo explícitamente

### Patrón de autenticación

- `apiKey` prop puede ser JWT de Thalamus o API key de Soma
- Si es JWT → se envía como `Authorization: Bearer <token>`
- Si es API key → se envía como `x-api-key: <key>`
- El SDK NO maneja OAuth2 — el integrador debe obtener el token

### WebSocket

- `useGlia()` abre WebSocket a `{baseUrl}/agent-ws`
- Protocolo: `init` → `prompt` → streaming de eventos → `done`
- `conversationId` opcional: si se pasa, el historial se carga del backend
- `welcomeMessage` se muestra como primer mensaje del agente

### Build y publish

```bash
cd sdk
npm run build   # tsup → dist/ (CJS + ESM + types)
npm publish     # → @zea.cl/soma-sdk en npm público
```

- `tsup.config.ts` genera `.js`, `.mjs`, `.d.ts`, `.d.mts`
- CI/CD: `.github/workflows/publish-npm.yml` con `NPM_TOKEN`

---

## Docker: multi-stage Alpine

### Estructura del Dockerfile

```
Stage 1 (deps):     hexpm/elixir:1.18.3 → mix deps.get
Stage 2 (build):    mix release → _build/prod/rel/soma
Stage 3 (runtime):  alpine:3.21.3
  ├── nodejs + npm + git + docker-cli + shadow + sudo
  ├── pi CLI global
  ├── Elixir release (bin/soma)
  ├── Pi sidecar (server/*.ts)
  ├── Scripts sandbox (soma-*-useradd/userdel)
  └── start.sh (entrypoint)
```

### Entrypoint (start.sh)

1. Crea directorios base (`/home`, `/workspace/orgs`)
2. Bootstrap: recrea usuarios Linux desde homes persistentes
3. Verifica que `pi` CLI esté disponible
4. Lanza Pi Sidecar con auto-restart (bucle `while true`)
5. Lanza Elixir API con `bin/soma start`

### Health checks

- Health check del contenedor: `wget --spider -q http://localhost:4084/health`
- Health check manual: `curl http://soma.zea.localhost/health` → `{"status":"ok","service":"soma"}`
- WebSocket: `wscat -c ws://soma.zea.localhost/agent-ws`

---

## API Elixir: Plug.Router (no Phoenix completo)

### Estructura

```
lib/soma_web/
├── router.ex           # Plug.Router principal, health + forward /api
├── endpoint.ex         # Endpoint (Cowboy)
├── controllers/
│   └── api_controller.ex
└── plugs/
    ├── auth_router.ex  # Sub-router con autenticación
    ├── jwt_auth.ex     # Validación JWT contra Thalamus JWKS
    ├── api_key_auth.ex # Validación API key contra BD
    └── guard.ex
```

### Convenciones de la API

- **Health**: `GET /health` → 200 (sin auth)
- **API**: `forward /api` → `AuthRouter` (con JWT o API key)
- **Legacy**: rutas directas `/api/conversations`, `/api/files`, etc. para backward compat
- **SPA**: cualquier ruta no-API → `priv/static/index.html`

### Auth

- JWT se valida contra `{THALAMUS_URL}/.well-known/jwks.json`
- API key se valida contra tabla `api_keys` en PostgreSQL
- JWT tiene prioridad sobre API key
- Sin auth → 401

---

## PostgreSQL: schema

### Base de datos

- Nombre: `soma_prod`
- Usuario: configurable vía `DATABASE_URL`
- Pool size: 3 (configurable vía `POOL_SIZE`)

### Migración única

`20240613000000_create_core_tables.exs` — crea todas las tablas iniciales.

### Tablas

| Tabla | Schema | Índices |
|---|---|---|
| `conversations` | id TEXT PK, user_id, title, last_message_at, message_count | — |
| `messages` | id UUID PK, conversation_id FK, role, content, thinking, tools JSONB | idx_messages_conv |
| `api_keys` | id, key_hash, organization_id, created_by, name | — |
| `skills` | id, name, content, agent_id, organization_id | — |
| `agent_shares` | id, agent_id, shared_by, shared_with, organization_id | — |
| `workspaces` | (archivos mapeados a paths en filesystem) | — |

### Conexión sidecar

El Pi Sidecar se conecta directamente a PostgreSQL (sin pasar por la API Elixir) usando el paquete `pg`. Crea tablas `conversations` y `messages` si no existen (migración lazy).

---

## CLI: soma (npm)

```bash
cd cli && npm link   # desarrollo local
```

La CLI está en `cli/index.js` y se comunica con la API Elixir vía REST. Autenticación con token JWT guardado en config local.

---

## Nombres y branding

- El paquete npm es `@zea.cl/soma-sdk` (NO `@zea/soma-sdk`)
- El nombre del servicio es "Soma" o "Soma AgentHub"
- Los componentes se llaman `Glia*` (GliaChat, GliaCopilot, etc.)
- La organización npm es `@zea.cl`
- El prefijo de API keys es `zs_live_`

---

## No hacer

- ❌ No usar `mix phx.server` — SIEMPRE usar `mix release` para builds de producción
- ❌ No hardcodear URLs de producción en el SDK (usa prop `baseUrl`)
- ❌ No exponer el Pi Sidecar sin autenticación (WebSocket requiere JWT)
- ❌ No crear usuarios Linux con `useradd` directamente — usar los scripts `soma-*-useradd`
- ❌ No asumir que Thalamus siempre responde — manejar fallback con array vacío
- ❌ No modificar el SDK sin rebuild + publish
- ❌ No pushear a main directamente — siempre vía PR
