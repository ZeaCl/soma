# Soma AgentHub — CLI (`soma-agent`)

> CLI para que desarrolladores y agentes configuren Soma desde la terminal.
> Misma API que la UI, pero en shell. Ideal para CI/CD, scripting, y DX.

---

## Filosofía

```
═══ Principios ═══

1. Un comando = una intención clara
2. --json para scripting (CI/CD)
3. --help útil en cada nivel
4. Mismos endpoints que la UI (no inventa nueva API)
5. Funciona sin Node.js (bash + curl)
```

---

## Instalación

```bash
# Desde el repo
curl -sL https://soma.zea.localhost/cli/install.sh | bash

# O manual
cp scripts/soma-agent /usr/local/bin/
chmod +x /usr/local/bin/soma-agent
```

```bash
# Configurar credenciales (una vez)
soma-agent auth login --email dev@zea.cl
# → Abre browser para OAuth2, guarda token en ~/.soma/config

# O con API key (CI/CD)
export SOMA_API_KEY=zs_live_xxx
export SOMA_API_URL=https://soma.zea.localhost
```

---

## Comandos

```
soma-agent
├── auth                        # Autenticación
│   ├── login                   # OAuth2 browser flow
│   ├── logout                  # Borra token local
│   ├── whoami                  # Muestra usuario actual
│   └── token                   # Genera API key
│
├── agent                       # Gestión de agentes
│   ├── create                  # Crea agente (usuario Linux + config)
│   ├── list                    # Lista agentes de la org
│   ├── show <id>               # Detalle de un agente
│   ├── config                  # Configuración del agente
│   │   ├── get <id>            # Ver config actual
│   │   ├── set <id>            # Actualizar campo
│   │   │   ├── --system-prompt
│   │   │   ├── --engine
│   │   │   ├── --tools
│   │   │   ├── --skills
│   │   │   └── --workspace-path
│   │   └── edit <id>           # Abrir config en $EDITOR
│   ├── sandbox                 # Sandbox del agente (OS-level)
│   │   ├── create <id>         # useradd + mkdir + chown + mounts
│   │   ├── destroy <id>        # userdel -r + umount
│   │   ├── mount
│   │   │   ├── add <id>        # mount --bind origen → home/destino
│   │   │   ├── list <id>       # Ver mounts activos
│   │   │   └── remove <id>     # umount
│   │   └── exec <id> <cmd>     # Ejecutar comando como el agente (sudo -u)
│   └── destroy <id>            # Borra agente + sandbox + config
│
├── skill                       # Gestión de skills
│   ├── list                    # Lista skills disponibles
│   ├── show <name>             # Ver contenido de una skill
│   ├── create <name>           # Crear skill custom (abre $EDITOR)
│   ├── edit <name>             # Editar skill custom
│   ├── delete <name>           # Borrar skill custom
│   └── assign <skill> <agent>  # Asignar skill a agente
│
├── workspace                   # Archivos del workspace
│   ├── list [path]             # Listar archivos
│   ├── upload <file> [path]    # Subir archivo
│   ├── download <path>         # Bajar archivo
│   ├── mkdir <path>            # Crear directorio
│   └── rm <path>               # Borrar archivo
│
├── conversation                # Conversaciones
│   ├── list                    # Listar conversaciones
│   ├── show <id>               # Ver mensajes de una conversación
│   └── chat <agent-id>         # Chat interactivo en terminal
│
├── engine                      # Motores de IA
│   ├── list                    # Motores disponibles
│   └── info <name>             # Detalle de un motor
│
└── doctor                      # Health check
    ├── run                     # Ejecutar doctor-soma.sh
    └── watch                   # Modo watch (cada 30s)
```

---

## Ejemplos de uso

### Crear un agente completo

```bash
# 1. Crear agente (usuario Linux + config inicial)
soma-agent agent create \
  --name "Code Reviewer" \
  --email "reviewer@zea.cl" \
  --org "org-1" \
  --engine pi \
  --system-prompt "Eres un revisor de código experto en TypeScript y Elixir." \
  --skills xlsx,code-review \
  --tools read,bash,edit,write

# Output:
# ✅ Agent created: c4e2791b-026b-4508-a2c3-1580bf86b661
# ✅ Linux user: soma-c4e2791b-0 (uid=2001)
# ✅ Home: /home/soma/c4e2791b-026b-4508-a2c3-1580bf86b661
# ✅ Groups: soma-agents, org-org-1
# ✅ Skills: xlsx, code-review
# ✅ Engine: pi

# 2. Crear sandbox con mounts
soma-agent agent sandbox create c4e2791b \
  --mount /workspace/orgs/org-1/shared:shared \
  --mount /mnt/datos-mercado:datos:ro

# Output:
# ✅ Sandbox created
# ✅ Mount: /workspace/orgs/org-1/shared → /home/soma/.../shared (rw)
# ✅ Mount: /mnt/datos-mercado → /home/soma/.../datos (ro)

# 3. Verificar que funciona
soma-agent agent sandbox exec c4e2791b "ls -la"
# Output:
# drwx------  soma-c4e2791b workspace
# drwxrwx---  soma-c4e2791b shared
# dr-xr-xr--  soma-c4e2791b datos

# 4. Ver mounts
soma-agent agent sandbox mount list c4e2791b
# Output:
# SOURCE                            DEST     RO
# /workspace/orgs/org-1/shared      shared   false
# /mnt/datos-mercado                datos    true
```

### Configurar engine y tools

```bash
# Cambiar engine a OpenCode
soma-agent agent config set c4e2791b --engine opencode

# Cambiar tools (solo lectura + bash)
soma-agent agent config set c4e2791b --tools read,bash

# Ver config completa
soma-agent agent config get c4e2791b --json
```

### CI/CD — crear agente efímero para tests

```bash
# Crear agente temporal
AGENT=$(soma-agent agent create \
  --name "CI Test Runner" \
  --engine pi \
  --tools read,bash \
  --ttl 2h \
  --json | jq -r '.id')

# Ejecutar tests como el agente
soma-agent agent sandbox exec $AGENT "cd workspace && npm test"

# Destruir al terminar
soma-agent agent destroy $AGENT
```

### Chat interactivo desde terminal

```bash
soma-agent conversation chat c4e2791b
# ┌─────────────────────────────────────────┐
# │  🧠 Soma Chat — Code Reviewer (pi)      │
# │  Escribí tu mensaje (Ctrl+D para salir) │
# └─────────────────────────────────────────┘
#
# ▶ You: Revisá este código:
#   def foo, do: :bar
#
# 🤖 Code Reviewer:
#   🟣 thinking: El código es correcto pero...
#   💬 El código es correcto pero `foo` es un
#      nombre poco descriptivo. Sugiero...
```

---

## Implementación

La CLI es un **script bash** que llama a la API REST de Soma. No requiere Node.js ni dependencias.

```bash
#!/bin/bash
# scripts/soma-agent — entry point

SOMA_API="${SOMA_API_URL:-http://soma.zea.localhost}"
SOMA_KEY="${SOMA_API_KEY:-}"
CONFIG_FILE="${HOME}/.soma/config"

# Cargar token si existe
if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
fi

# Resolver auth header
auth_header() {
  if [ -n "$SOMA_KEY" ]; then
    echo "x-api-key: $SOMA_KEY"
  elif [ -n "$SOMA_TOKEN" ]; then
    echo "Authorization: Bearer $SOMA_TOKEN"
  else
    echo "⚠️  No autenticado. Ejecutá: soma-agent auth login" >&2
    exit 1
  fi
}

# Subcomandos
case "${1:-}" in
  agent)    source "${BASH_SOURCE%/*}/commands/agent.sh";    shift; agent_main "$@" ;;
  skill)    source "${BASH_SOURCE%/*}/commands/skill.sh";    shift; skill_main "$@" ;;
  workspace)source "${BASH_SOURCE%/*}/commands/workspace.sh";shift; workspace_main "$@" ;;
  engine)   source "${BASH_SOURCE%/*}/commands/engine.sh";   shift; engine_main "$@" ;;
  doctor)   source "${BASH_SOURCE%/*}/commands/doctor.sh";   shift; doctor_main "$@" ;;
  auth)     source "${BASH_SOURCE%/*}/commands/auth.sh";     shift; auth_main "$@" ;;
  conversation) source "${BASH_SOURCE%/*}/commands/conversation.sh"; shift; conv_main "$@" ;;
  *)        echo "Usage: soma-agent <command> [args...]";    exit 1 ;;
esac
```

### Comando: `agent create`

```bash
# scripts/soma/commands/agent.sh

agent_create() {
  local name="" email="" org="" engine="pi"
  local system_prompt="" skills="" tools="read,bash,edit,write"
  local mounts="" ttl=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --name)          name="$2"; shift 2 ;;
      --email)         email="$2"; shift 2 ;;
      --org)           org="$2"; shift 2 ;;
      --engine)        engine="$2"; shift 2 ;;
      --system-prompt) system_prompt="$2"; shift 2 ;;
      --skills)        skills="$2"; shift 2 ;;
      --tools)         tools="$2"; shift 2 ;;
      --mount)         mounts="$mounts $2"; shift 2 ;;
      --ttl)           ttl="$2"; shift 2 ;;
      *)               shift ;;
    esac
  done

  # 1. Crear usuario en Thalamus
  local resp=$(curl -s -X POST "$SOMA_API/api/v1/agents" \
    -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$name\",
      \"email\": \"$email\",
      \"org_id\": \"$org\",
      \"is_agent\": true,
      \"agent_config\": {
        \"engine\": \"$engine\",
        \"system_prompt\": \"$system_prompt\",
        \"skills\": $(echo "$skills" | jq -R 'split(",")'),
        \"tools\": $(echo "$tools" | jq -R 'split(",")')
      }
    }")

  local agent_id=$(echo "$resp" | jq -r '.id // .data.id')
  echo "✅ Agent created: $agent_id"

  # 2. Crear sandbox (usuario Linux)
  local sandbox_resp=$(curl -s -X POST "$SOMA_API/api/v1/agents/$agent_id/sandbox" \
    -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    -d "{\"org_id\": \"$org\", \"mounts\": $(mounts_to_json "$mounts\")}")

  echo "$sandbox_resp" | jq -r '.message'

  # 3. Devolver ID para scripting
  if [ "$JSON_OUTPUT" = "true" ]; then
    echo "{\"id\": \"$agent_id\"}"
  fi
}
```

---

## API Endpoints necesarios

```
POST   /api/v1/agents                    # Crear agente (Thalamus + config)
GET    /api/v1/agents                    # Listar agentes
GET    /api/v1/agents/:id                # Detalle de un agente
PUT    /api/v1/agents/:id/config         # Actualizar config (engine, tools, etc.)
DELETE /api/v1/agents/:id                # Soft-delete agente

POST   /api/v1/agents/:id/sandbox        # Crear sandbox (useradd + mounts)
DELETE /api/v1/agents/:id/sandbox        # Destruir sandbox (userdel -r)
POST   /api/v1/agents/:id/sandbox/mounts # Agregar mount
GET    /api/v1/agents/:id/sandbox/mounts # Listar mounts
DELETE /api/v1/agents/:id/sandbox/mounts/:mount  # Quitar mount

GET    /api/v1/engines                   # Listar motores disponibles
GET    /api/v1/engines/:name             # Info de un motor

POST   /api/v1/auth/login                # OAuth2 PKCE init
POST   /api/v1/auth/token                # Exchange code → token
GET    /api/v1/auth/whoami               # Perfil del token actual
```

---

## DX (Developer Experience)

```
═══ Antes (sin CLI) ═════════════════════════════════════

$ curl -X POST https://soma.zea.localhost/api/v1/agents \
    -H "x-api-key: zs_live_xxx..." \
    -H "Content-Type: application/json" \
    -d '{"name":"...","agent_config":{"engine":"pi",...}}'
# → JSON ilegible, hay que escapar comillas, etc.

$ curl ... /agents/:id/config -X PUT -d '{"engine":"react"}'
$ curl ... /agents/:id/sandbox -X POST -d '{"mounts":[...]}'
$ ssh soma-server "sudo useradd soma-xxx ..."
# → 5 comandos, 3 contextos distintos


═══ Después (con CLI) ═══════════════════════════════════

$ soma-agent agent create \
    --name "Reviewer" \
    --engine pi \
    --tools read,bash \
    --mount /shared:shared
# → 1 comando, output legible, todo resuelto

$ soma-agent agent config set reviewer --engine opencode
$ soma-agent agent sandbox mount add reviewer /nuevo-dato:datos
$ soma-agent doctor run
# → Todo desde la terminal, sin cambiar de contexto
```

---

## Plan de implementación

| # | Tarea | Esfuerzo |
|---|-------|----------|
| 1 | `scripts/soma-agent` — entry point + auth | 1h |
| 2 | `scripts/commands/agent.sh` — CRUD de agentes | 2h |
| 3 | `scripts/commands/skill.sh` — CRUD de skills | 1h |
| 4 | `scripts/commands/workspace.sh` — upload/download/list | 1h |
| 5 | `scripts/commands/engine.sh` — list/info | 30m |
| 6 | `scripts/commands/conversation.sh` — chat interactivo | 2h |
| 7 | `scripts/commands/doctor.sh` — wrapper de doctor-soma.sh | 30m |
| 8 | `scripts/commands/auth.sh` — login/logout OAuth2 | 1h |
| 9 | Endpoints API faltantes en `api_controller.ex` | 3h |
| 10 | Test: CI/CD crea y destruye agente efímero | 1h |
| **Total** | | **13 horas** |
