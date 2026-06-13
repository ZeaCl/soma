#!/bin/bash
# soma-agent agent — CRUD de agentes

agent_main() {
  case "${1:-}" in
    create)   shift; agent_create "$@" ;;
    list)     agent_list ;;
    show)     shift; agent_show "$@" ;;
    config)   shift; agent_config "$@" ;;
    sandbox)  shift; agent_sandbox "$@" ;;
    destroy)  shift; agent_destroy "$@" ;;
    *)        echo "Usage: soma-agent agent <create|list|show|config|sandbox|destroy>"
              exit 1 ;;
  esac
}

# ── Create ────────────────────────────────────────────────────────────────

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

  if [ -z "$name" ]; then
    echo "❌ --name is required"
    exit 1
  fi

  # Create agent via API
  local resp
  resp=$(curl -s -X POST "${SOMA_API}/api/v1/agents" \
    -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$name\",
      \"email\": \"${email:-$name@agent.local}\",
      \"org_id\": \"${org:-}\",
      \"engine\": \"$engine\",
      \"system_prompt\": \"$system_prompt\",
      \"skills\": $(echo "$skills" | python3 -c "import sys; print(__import__('json').dumps(sys.stdin.read().strip().split(',') if sys.stdin.read().strip() else []))" 2>/dev/null || echo "[]"),
      \"tools\": $(echo "$tools" | python3 -c "import sys; print(__import__('json').dumps(sys.stdin.read().strip().split(',') if sys.stdin.read().strip() else []))" 2>/dev/null || echo "[]")
    }")

  local agent_id
  agent_id=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)

  if [ -z "$agent_id" ]; then
    echo "❌ Failed to create agent"
    echo "$resp"
    exit 1
  fi

  echo "✅ Agent created: $agent_id"
  echo "   Name: $name"
  echo "   Engine: $engine"
  [ -n "$system_prompt" ] && echo "   System prompt: ${system_prompt:0:60}..."
  echo "   Tools: $tools"

  if [ "$JSON_OUTPUT" = "true" ]; then
    echo "{\"id\":\"$agent_id\",\"name\":\"$name\",\"engine\":\"$engine\"}"
  fi
}

# ── List ──────────────────────────────────────────────────────────────────

agent_list() {
  curl -s "${SOMA_API}/api/v1/agents" -H "$(auth_header)" | \
    python3 -c "
import sys, json
data = json.load(sys.stdin).get('data', [])
if not data:
    print('No agents found.')
    sys.exit(0)
print(f'{\"ID\":<38} {\"NAME\":<25} {\"ENGINE\":<10} AGENT')
print('-' * 85)
for a in data:
    c = a.get('agent_config', {}) or {}
    e = c.get('engine', 'pi')
    print(f\"{a['id']:<38} {a.get('name',a.get('email','?')):<25} {e:<10} {'✅' if a.get('is_agent') else '👤'}\")
print(f'\nTotal: {len(data)} agents')
" 2>/dev/null || echo "❌ API unreachable"
}

# ── Show ──────────────────────────────────────────────────────────────────

agent_show() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "Usage: soma-agent agent show <id>"; exit 1; }

  curl -s "${SOMA_API}/api/v1/agents/$id" -H "$(auth_header)" | \
    python3 -c "
import sys, json
a = json.load(sys.stdin).get('data', {})
if not a: print('Not found'); sys.exit(1)
c = a.get('agent_config', {}) or {}
print(f'ID:       {a[\"id\"]}')
print(f'Name:     {a.get(\"name\", a.get(\"email\", \"?\"))}')
print(f'Agent:    {a.get(\"is_agent\", False)}')
print(f'Engine:   {c.get(\"engine\", \"pi\")}')
print(f'Skills:   {c.get(\"skills\", [])}')
print(f'Tools:    {c.get(\"tools\", [])}')
print(f'Prompt:   {(c.get(\"system_prompt\") or \"\")[:80]}')
print(f'Workspace:{c.get(\"workspace_paths\", [])}')
" 2>/dev/null
}

# ── Config ────────────────────────────────────────────────────────────────

agent_config() {
  local sub="${1:-}"; shift || true
  case "$sub" in
    get) agent_config_get "$@" ;;
    set) agent_config_set "$@" ;;
    *)   echo "Usage: soma-agent agent config <get|set> <id> [--engine X] [--system-prompt \"...\"] [--tools a,b] [--skills a,b]"; exit 1 ;;
  esac
}

agent_config_get() {
  local id="${1:-}"
  agent_show "$id"
}

agent_config_set() {
  local id="${1:-}"; shift
  [ -z "$id" ] && { echo "Usage: soma-agent agent config set <id> [flags]"; exit 1; }

  local engine="" system_prompt="" tools="" skills=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --engine)        engine="$2"; shift 2 ;;
      --system-prompt) system_prompt="$2"; shift 2 ;;
      --tools)         tools="$2"; shift 2 ;;
      --skills)        skills="$2"; shift 2 ;;
      *)               shift ;;
    esac
  done

  local body="{}"
  [ -n "$engine" ] && body=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); d['engine']='$engine'; print(json.dumps(d))")
  [ -n "$system_prompt" ] && body=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); d['system_prompt']='$system_prompt'; print(json.dumps(d))")
  [ -n "$tools" ] && body=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); d['tools']='$tools'.split(','); print(json.dumps(d))")
  [ -n "$skills" ] && body=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); d['skills']='$skills'.split(','); print(json.dumps(d))")

  curl -s -X PUT "${SOMA_API}/api/v1/agents/$id/config" \
    -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    -d "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Updated' if d.get('ok') else '❌ '+d.get('error','Failed'))"
}

# ── Sandbox ───────────────────────────────────────────────────────────────

agent_sandbox() {
  local sub="${1:-}"; shift || true
  case "$sub" in
    create)  agent_sandbox_create "$@" ;;
    destroy) agent_sandbox_destroy "$@" ;;
    mount)   shift; agent_sandbox_mount "$@" ;;
    exec)    shift; agent_sandbox_exec "$@" ;;
    *)       echo "Usage: soma-agent agent sandbox <create|destroy|mount|exec> <id> [...]"; exit 1 ;;
  esac
}

agent_sandbox_create() {
  local id="${1:-}"; shift
  [ -z "$id" ] && { echo "Usage: soma-agent agent sandbox create <id> [--mount src:dst[:ro]]"; exit 1; }

  local mounts_json="[]"
  while [ $# -gt 0 ]; do
    case "$1" in
      --mount)
        IFS=':' read -r src dst ro <<< "$2"
        mounts_json=$(echo "$mounts_json" | python3 -c "import sys,json; d=json.load(sys.stdin); d.append({'source':'$src','dest':'${dst:-shared}','ro':${ro:+true}}); print(json.dumps(d))")
        shift 2 ;;
      *) shift ;;
    esac
  done

  curl -s -X POST "${SOMA_API}/api/v1/agents/$id/sandbox" \
    -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    -d "{\"mounts\":$mounts_json}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Sandbox created' if d.get('ok') else '❌ '+d.get('error','Failed'))"
}

agent_sandbox_destroy() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "Usage: soma-agent agent sandbox destroy <id>"; exit 1; }

  curl -s -X DELETE "${SOMA_API}/api/v1/agents/$id/sandbox" \
    -H "$(auth_header)" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Sandbox destroyed' if d.get('ok') else '❌ '+d.get('error','Failed'))"
}

agent_sandbox_mount() {
  local sub="${1:-}"; shift || true
  local id="${1:-}"; shift || true
  case "$sub" in
    add)    curl -s -X POST "${SOMA_API}/api/v1/agents/$id/sandbox/mounts" -H "$(auth_header)" -H "Content-Type: application/json" -d '{"source":"'${1:-}'","dest":"'${2:-shared}'"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Mounted' if d.get('ok') else '❌ '+d.get('error','Failed'))" ;;
    list)   curl -s "${SOMA_API}/api/v1/agents/$id/sandbox/mounts" -H "$(auth_header)" | python3 -m json.tool 2>/dev/null ;;
    remove) curl -s -X DELETE "${SOMA_API}/api/v1/agents/$id/sandbox/mounts/${1:-}" -H "$(auth_header)" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Unmounted' if d.get('ok') else '❌ '+d.get('error','Failed'))" ;;
    *)      echo "Usage: soma-agent agent sandbox mount <add|list|remove> <id> [...]"; exit 1 ;;
  esac
}

agent_sandbox_exec() {
  local id="${1:-}"; shift
  [ -z "$id" ] && { echo "Usage: soma-agent agent sandbox exec <id> <command>"; exit 1; }
  echo "⚠️  Sandbox exec not yet implemented (requires OS-level sandbox)"
}

# ── Destroy ───────────────────────────────────────────────────────────────

agent_destroy() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "Usage: soma-agent agent destroy <id>"; exit 1; }

  read -r -p "⚠️  Destroy agent $id? This cannot be undone. [y/N] " confirm
  [ "$confirm" != "y" ] && { echo "Cancelled."; exit 0; }

  curl -s -X DELETE "${SOMA_API}/api/v1/agents/$id" \
    -H "$(auth_header)" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Agent destroyed' if d.get('ok') else '❌ '+d.get('error','Failed'))"
}
