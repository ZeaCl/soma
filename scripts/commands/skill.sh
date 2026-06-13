#!/bin/bash
# soma-agent skill — CRUD de skills

skill_main() {
  case "${1:-}" in
    list)   skill_list ;;
    show)   skill_show "${2:-}" ;;
    create) skill_create "${2:-}" ;;
    delete) skill_delete "${2:-}" ;;
    assign) skill_assign "${2:-}" "${3:-}" ;;
    *)      echo "Usage: soma-agent skill <list|show|create|delete|assign> [args]"; exit 1 ;;
  esac
}

skill_list() {
  curl -s "${SOMA_API}/api/v1/skills" -H "$(auth_header)" | \
    python3 -c "
import sys, json
data = json.load(sys.stdin).get('data', [])
if not data: print('No skills.'); sys.exit(0)
print(f'{\"NAME\":<30} {\"TYPE\":<10} DESCRIPTION')
print('-' * 70)
for s in data:
    t = 'custom' if s.get('custom') else 'builtin'
    d = (s.get('description','') or '')[:40]
    print(f'{s[\"name\"]:<30} {t:<10} {d}')
print(f'\nTotal: {len(data)} skills')
" 2>/dev/null || echo "❌ API unreachable"
}

skill_show() {
  local name="${1:-}"
  [ -z "$name" ] && { echo "Usage: soma-agent skill show <name>"; exit 1; }
  curl -s "${SOMA_API}/api/v1/skills/$name" -H "$(auth_header)" | python3 -m json.tool 2>/dev/null
}

skill_create() {
  local name="${1:-}"
  [ -z "$name" ] && { echo "Usage: soma-agent skill create <name>"; echo "Opens \$EDITOR to write the SKILL.md"; exit 1; }

  local tmpfile="/tmp/soma-skill-${name}.md"
  echo "# $name" > "$tmpfile"
  echo "" >> "$tmpfile"
  echo "description: " >> "$tmpfile"
  echo "" >> "$tmpfile"
  ${EDITOR:-vi} "$tmpfile"

  local content
  content=$(cat "$tmpfile")
  rm -f "$tmpfile"

  curl -s -X POST "${SOMA_API}/api/v1/skills" \
    -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import sys,json; print(json.dumps({'name':'$name','content':'''$content'''}))" 2>/dev/null)" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Skill created' if d.get('data') else '❌ '+d.get('error','Failed'))"
}

skill_delete() {
  local name="${1:-}"
  [ -z "$name" ] && { echo "Usage: soma-agent skill delete <name>"; exit 1; }
  curl -s -X DELETE "${SOMA_API}/api/v1/skills/$name" -H "$(auth_header)" -o /dev/null -w "%{http_code}"
  echo ""
}

skill_assign() {
  local skill="${1:-}" agent="${2:-}"
  [ -z "$skill" ] || [ -z "$agent" ] && { echo "Usage: soma-agent skill assign <skill> <agent-id>"; exit 1; }
  curl -s -X PUT "${SOMA_API}/api/v1/skills/$skill/agents" \
    -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    -d "{\"agentIds\":[\"$agent\"]}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Assigned' if d.get('assigned_to') else '❌ Failed')"
}
