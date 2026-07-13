# Estado de Sesión — Soma AgentHub

> Leer esto al iniciar una sesión nueva. Contiene TODO el contexto necesario para continuar trabajando en Soma.

---

## ¿Qué es Soma?

AgentHub multi-agente de ZEA. Provee chat con agentes IA, sandbox aislado por usuario Linux real, workspaces, skills, y orquestación de agentes. Dos procesos en el mismo contenedor:

```
CONTENEDOR Soma (Alpine Linux)
├── Pi Sidecar (:3002) — WebSocket chat agentes + HTTP API
│   ├── agent-rpc.ts — orquestador (init → prepareAgent → bridge → prompt)
│   ├── agent-sandbox.ts — ciclo de vida del sandbox (useradd/userdel)
│   └── rpc-bridge.ts — stdin/stdout JSONL ↔ pi --mode rpc
│
├── Elixir API (:4084) — Phoenix Plug.Router
│   ├── Conversaciones + mensajes (PostgreSQL)
│   ├── Workspace files (disco + sandbox Linux)
│   ├── Skills CRUD
│   ├── API Keys
│   └── Agent shares (compartir agentes entre usuarios)
│
└── Sandbox Layer (OS)
    └── /home/soma-{shortId}/ y /home/user-{shortId}/
        ├── workspace/ (archivos)
        ├── .agents/skills/ (skills del agente)
        └── .pi-sessions/ (sesiones pi)
```

---

## Cómo levantar localmente

### Opción A: Docker standalone (recomendado para desarrollo)

```bash
cd /Users/dev/Documents/zea/soma

# Build
docker build -t soma .

# Run (necesita PostgreSQL disponible)
docker run -d \
  -p 4084:4084 -p 3002:3002 \
  -e DATABASE_URL="ecto://postgres:postgres@host.docker.internal:5432/soma_prod" \
  -e SECRET_KEY_BASE="dev-secret-64-bytes-minimum-CHANGE-in-production-xxxxxxxxxx" \
  -e THALAMUS_URL="http://thalamus:4000" \
  -v soma-homes:/home \
  --name soma \
  soma
```

### Opción B: Con el compose local de ZEA

```bash
cd /Users/dev/Documents/zea/zea
docker compose -f docker-compose.local.yml up -d --build soma
```

⚠️ Soma aún NO está en el compose local — [Fase 0 en progreso].

### Opción C: Sin Docker (solo Elixir API, útil para debug)

```bash
cd /Users/dev/Documents/zea/soma
mix deps.get
mix ecto.create && mix ecto.migrate
mix phx.server   # :4084
```

El Pi Sidecar (WebSocket agentes) NO funciona sin Docker (necesita `sudo`, `useradd`, `pi` CLI).

---

## Servicios requeridos

| Servicio | URL | Puerto | ¿Obligatorio? | Notas |
|---|---|---|---|---|
| PostgreSQL | `postgres:5432` | 5432 | ✅ Sí | BD `soma_prod`, 1 migración |
| Thalamus | `auth.zea.localhost` | 4000 | ✅ Sí | Auth JWT, agent skills, JWKS |
| Pi CLI | `pi --mode rpc` | — | ✅ Sí | Subproceso por agente, instalado global en el contenedor |

---

## Variables de entorno

| Variable | Default | Uso |
|---|---|---|
| `DATABASE_URL` | `ecto://postgres:postgres_secure_password@postgres:5432/soma_prod` | Conexión a PostgreSQL |
| `SECRET_KEY_BASE` | `dev-secret-CHANGE-ME...` | Firmado de cookies/tokens |
| `PHX_HOST` | `soma.zea.localhost` | Host del endpoint |
| `PORT` | `4084` | Puerto de la API Elixir |
| `AGENT_RPC_PORT` | `3002` | Puerto del Pi Sidecar |
| `THALAMUS_URL` | `http://thalamus:4000` | URL base de Thalamus |
| `AGENT_HOST` | `http://zea-agent:3001` | Host interno de agentes |

---

## Endpoints y health checks

```bash
# Health check
curl http://soma.zea.localhost/health
# → {"status":"ok","service":"soma"}

# WebSocket agentes
wscat -c ws://soma.zea.localhost/agent-ws
# → init → prepareAgent → bridge → prompt
```

---

## Base de datos

### Schema: `soma_prod`

**Migración única**: `20240613000000_create_core_tables.exs`

Tablas principales:
- `conversations` — conversaciones de agentes
- `messages` — mensajes dentro de conversaciones
- `workspaces` — archivos de workspace
- `skills` — skills custom
- `api_keys` — API keys por organización
- `agent_shares` — agentes compartidos entre usuarios

### Conectarse

```bash
# Directo
psql -h localhost -U postgres -d soma_prod

# Vía Docker (si está en compose)
docker exec -it zea_postgres_local psql -U postgres -d soma_prod
```

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| API | Elixir 1.18, Phoenix (Plug.Router), Ecto, PostgreSQL |
| Sidecar | Node.js, TypeScript, `ws` (WebSocket), `pg` |
| Sandbox | Linux users (shadow/sudo), pi CLI (`@earendil-works/pi-coding-agent`) |
| SDK | React 18/19, TypeScript, tsup |
| CLI | Node.js |
| Infra | Docker multi-stage, Alpine Linux 3.21, start.sh con auto-restart |

---

## Dependencias Elixir

```elixir
# mix.exs
{:phoenix, "~> 1.7"}        # Web framework
{:plug_cowboy, "~> 2.7"}    # HTTP server
{:jason, "~> 1.4"}          # JSON
{:joken, "~> 2.6"}          # JWT
{:req, "~> 0.5"}            # HTTP client (para Thalamus)
{:ecto_sql, "~> 3.12"}      # ORM
{:postgrex, "~> 0.19"}      # PostgreSQL driver
{:corsica, "~> 2.1"}        # CORS
```

---

## SDK (@zea.cl/soma-sdk)

Paquete npm público: `@zea.cl/soma-sdk@0.1.2`

### Componentes exportados

| Componente | Uso |
|---|---|
| `GliaChat` | Chat completo con agente IA (WebSocket) |
| `GliaCopilot` | Botón flotante de chat |
| `GliaConversationList` | Historial de conversaciones |
| `GliaFileBrowser` | Navegador de archivos de workspace |
| `GliaFileViewer` | Visor de archivos |
| `GliaSkillEditor` | Editor de skills |
| `AgentSkillPanel` | Panel de skills de agente |
| `SomaPanel` | Panel de navegación files/skills |
| `SkillManager` | Gestor de skills |
| `UserWorkspace` | Workspace de usuario humano |
| `UserFileDropZone` | Zona de drop para upload |

### Hooks exportados

| Hook | Uso |
|---|---|
| `useGlia()` | WebSocket chat: send, cancel, messages, isStreaming |
| `useGliaConversations()` | Listar conversaciones |
| `useGliaFiles()` | Archivos de workspace |
| `useGliaFileContent()` | Contenido de archivo |
| `useGliaSkills()` | Skills management |
| `useGliaAgents()` | Agent management |
| `useUserWorkspace()` | Workspace de usuario |

### Build y publish

```bash
cd /Users/dev/Documents/zea/soma/sdk
npm run build   # tsup → dist/
npm publish     # publica en npm registry
```

---

## Skills para agentes IA

Soma incluye skills que los agentes usan para entender cómo interactuar:

| Skill | Archivo | Para qué |
|---|---|---|
| `soma-agents` | `skill/SKILL.md` | Integrar Soma en apps React, SDK, auth, CLI |
| `user-sandbox` | `skill/user-sandbox/SKILL.md` | Gestionar sandboxes de usuarios, files API |

---

## Gotchas y bugs conocidos

| # | Problema | Workaround |
|---|---|---|
| 1 | Pi CLI no instalado → agentes no inician | `npm install -g @earendil-works/pi-coding-agent` dentro del contenedor |
| 2 | Volumen `/home` persiste entre deploys pero usuarios Linux no | `start.sh` recrea usuarios desde homes existentes |
| 3 | Skills vacías en pi-backend → `nil` skills | Fix en `c70491c`: fallback a array vacío |
| 4 | `sudo -u` falla si el usuario no existe | `agent-sandbox.ts` crea el usuario vía `soma-agent-useradd` antes del bridge |
| 5 | Migraciones no corren automáticamente en prod | Ejecutar `bin/soma eval 'Soma.Release.migrate()'` manualmente |
| 6 | SDK publica en npm público → requiere token `NPM_TOKEN` en CI | Configurado en `.github/workflows/publish-npm.yml` |
| 7 | Hardcoded localhost URLs en algunos lugares | Fix en `de6c112`: cambiadas a dominio de producción `zea.cl` |

---

## Repositorios relacionados

| Repo | Path | Rol |
|---|---|---|
| soma | `/Users/dev/Documents/zea/soma` | Este repo |
| sudlich | `/Users/dev/Documents/zea/sudlich` | Frontend que integra Soma |
| sudlich-soma | `/Users/dev/Documents/zea/sudlich-soma` | Fork de sudlich para integración (Fase 0) |
| thalamus | `/Users/dev/Documents/zea/thalamus` | Auth OAuth2, JWT, agent tokens |
| cranium | `/Users/dev/Documents/zea/cranium` | Shell de plataforma, pieces |
| zea (infra) | `/Users/dev/Documents/zea/zea` | Docker compose, Caddy, .env |

---

## CI/CD

- **Build**: `.github/workflows/build.yml`
- **Publish SDK**: `.github/workflows/publish-npm.yml` — publica `@zea.cl/soma-sdk` en npm público
- **Docker**: build local multi-stage, no hay GitHub Container Registry configurado aún

---

## Documentos clave

| Documento | Path |
|---|---|
| README.md | `/Users/dev/Documents/zea/soma/README.md` |
| Integration Guide | `/Users/dev/Documents/zea/soma/INTEGRATION_GUIDE.md` |
| Plan de Aislamiento | `/Users/dev/Documents/zea/soma/PLAN-ISOLATION.md` |
| AGENTS.md | `/Users/dev/Documents/zea/soma/AGENTS.md` (Fase -1) |
| Local dev skill | `/Users/dev/Documents/zea/skills/local-dev/SKILL.md` |
| Thalamus docs | `/Users/dev/Documents/zea/thalamus/docs/` |

---

## Issues activos

**GitHub Project**: https://github.com/orgs/ZeaCl/projects/18

| Fase | Estado |
|---|---|
| -1 — Documentación base | ⬜ Pendiente |
| 0 — Infraestructura (compose) | ⬜ Pendiente |
| 1 — SDK + piece GliaChat | ⬜ Pendiente |
| 2 — Panel derecho con agentes | ⬜ Pendiente |
| 3 — Workspace files + skills | ⬜ Pendiente |
