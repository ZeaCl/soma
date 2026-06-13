#!/bin/bash
# soma-agent conversation — list, show, chat

conv_main() {
  case "${1:-}" in
    list) conv_list ;;
    show) conv_show "${2:-}" ;;
    chat) conv_chat "${2:-}" ;;
    *)    echo "Usage: soma-agent conversation <list|show|chat> [id]"; exit 1 ;;
  esac
}

conv_list() {
  curl -s "${SOMA_API}/api/v1/conversations" -H "$(auth_header)" | \
    python3 -c "
import sys, json
data = json.load(sys.stdin).get('conversations', json.load(sys.stdin).get('data', []))
if not data: print('No conversations.'); sys.exit(0)
print(f'{\"ID\":<40} {\"TITLE\":<30} {\"MSGS\":<6} LAST ACTIVE')
print('-' * 95)
for c in data:
    print(f\"{c['id']:<40} {(c.get('title','') or 'Untitled')[:28]:<30} {c.get('message_count','?'):<6} {c.get('lastMessageAt','')[:19]}\")
print(f'\nTotal: {len(data)} conversations')
" 2>/dev/null || echo "❌ API unreachable"
}

conv_show() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "Usage: soma-agent conversation show <id>"; exit 1; }
  curl -s "${SOMA_API}/api/v1/conversations/$id" -H "$(auth_header)" | \
    python3 -c "
import sys, json
d = json.load(sys.stdin)
msgs = d.get('messages', [])
for m in msgs:
    role = '👤' if m['role'] == 'user' else '🤖'
    content = (m.get('content','') or '')[:120]
    thinking = m.get('thinking','')
    print(f'{role} [{m[\"role\"]}] {content}')
    if thinking:
        print(f'   🟣 thinking: {thinking[:80]}...')
    print()
print(f'{len(msgs)} messages')
" 2>/dev/null || echo "❌ Not found"
}

conv_chat() {
  local agent_id="${1:-}"
  [ -z "$agent_id" ] && { echo "Usage: soma-agent conversation chat <agent-id>"; exit 1; }

  echo "🧠 Chat with $agent_id"
  echo "   Type your message (Ctrl+D to exit)"
  echo ""

  # Interactive chat via WebSocket would require a Python/Node.js client.
  # For now, fall back to single prompt via curl.
  echo "⚠️  Interactive chat requires websocket client."
  echo "   Use the web UI at ${SOMA_API} for now."
  echo ""
  echo "   Or send a single message:"
  echo "   curl -X POST ${SOMA_API}/api/v1/conversations/dm:${agent_id}/messages \\"
  echo "     -H 'x-api-key: \$SOMA_API_KEY' \\"
  echo "     -d '{\"role\":\"user\",\"content\":\"Hello\"}'"
}
