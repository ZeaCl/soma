#!/bin/bash
# soma-agent auth — OAuth2 login, logout, whoami, token generation

auth_main() {
  case "${1:-}" in
    login)    auth_login ;;
    logout)   auth_logout ;;
    whoami)   auth_whoami ;;
    token)    auth_token ;;
    *)        echo "Usage: soma-agent auth <login|logout|whoami|token>"; exit 1 ;;
  esac
}

auth_login() {
  echo "🔑 Opening browser for OAuth2 login..."
  echo "   URL: ${SOMA_API}/auth/login"
  echo ""
  echo "   After authenticating, paste your API key:"
  read -r -p "   API Key: " key

  if [ -z "$key" ]; then
    echo "❌ No API key provided"
    exit 1
  fi

  mkdir -p "$(dirname "$CONFIG_FILE")"
  echo "SOMA_API_KEY=$key" > "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  echo "✅ Logged in. Token saved to $CONFIG_FILE"
  echo "   Run: soma-agent auth whoami"
}

auth_logout() {
  rm -f "$CONFIG_FILE"
  echo "✅ Logged out."
}

auth_whoami() {
  curl -s "${SOMA_API}/api/v1/conversations" -H "$(auth_header)" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Authenticated —', len(d.get('conversations',d.get('data',[]))), 'conversations')" 2>/dev/null || \
    echo "❌ Not authenticated or API unreachable"
}

auth_token() {
  local key
  key=$(curl -s -X POST "${SOMA_API}/api/v1/api-keys" \
    -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    -d '{"name":"cli-token","scopes":["soma:read","soma:write"]}' | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('api_key',''))" 2>/dev/null)

  if [ -n "$key" ]; then
    echo "🔑 New API key: $key"
    echo "   Set with: export SOMA_API_KEY=$key"
  else
    echo "❌ Failed to generate token"
    exit 1
  fi
}
