#!/bin/bash
# soma-agent engine — list/info available AI engines

engine_main() {
  case "${1:-}" in
    list) engine_list ;;
    info) engine_info "${2:-}" ;;
    *)    echo "Usage: soma-agent engine <list|info> [name]"; exit 1 ;;
  esac
}

engine_list() {
  echo "🔌 Available engines:"
  echo ""
  # Static list until GET /api/v1/engines is deployed
  cat <<EOF
  pi        🥧  Pi — Coding agent with tools & skills            ✅ Ready
  react     🔄  ReAct — Reasoning + tool-calling loop             🚧 Coming soon
  opencode  📖  OpenCode — Autonomous code generation            🚧 Coming soon
  hermes    🪽  Hermes — Fast, lightweight agent                  🚧 Coming soon
  goose     🪿  Goose — Block's open-source agent                 🚧 Coming soon
EOF
}

engine_info() {
  local name="${1:-pi}"
  case "$name" in
    pi)
      echo "🥧 Pi Engine"
      echo "   Runtime: @earendil-works/pi-coding-agent"
      echo "   Tools: read, bash, edit, write"
      echo "   Features: compaction, skills, system prompt override"
      echo "   Status: ✅ Ready"
      ;;
    react)
      echo "🔄 ReAct Engine"
      echo "   Runtime: LangChain / LangGraph"
      echo "   Pattern: Reasoning + Action loop"
      echo "   Status: 🚧 Coming soon"
      ;;
    *)
      echo "❌ Unknown engine: $name"
      echo "   Run: soma-agent engine list"
      ;;
  esac
}
