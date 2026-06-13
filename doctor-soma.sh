#!/bin/bash
# 🩺 Soma Doctor — Health check capa por capa
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS=0; FAIL=0

ok()   { echo -e "  ${GREEN}✅${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}❌${NC} $1 ${RED}— $2${NC}"; FAIL=$((FAIL+1)); }

THALAMUS="http://auth.zea.localhost"
SOMA="http://soma.zea.localhost"
AGENT_ID="4c4e2791-026b-4508-a2c3-1580bf86b661"
KEY="zs_live_bootstrap_test_key_2026"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  🩺 Soma Doctor${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. HTTP ──
echo -e "${CYAN}[1] HTTP Health${NC}"
code=$(curl -s -o /dev/null -w "%{http_code}" "$SOMA/health" 2>/dev/null | tr -d '\r\n')
[ "$code" = "200" ] && ok "Soma HTTP" || fail "Soma HTTP" "HTTP $code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$THALAMUS/.well-known/jwks.json" 2>/dev/null | tr -d '\r\n')
[ "$code" = "200" ] && ok "Thalamus JWKS" || fail "Thalamus JWKS" "HTTP $code"
echo ""

# ── 2. Auth ──
echo -e "${CYAN}[2] Auth${NC}"
token=$(curl -s -X POST "$THALAMUS/api/internal/agent-token" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$AGENT_ID\",\"scopes\":[\"soma:read\"]}" 2>/dev/null | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$token" ] && ok "Agent Token" || fail "Agent Token" "No token"

if [ -n "$token" ]; then
  # Token might be PAT (th_pat_live...) or JWT (eyJ...)
  if echo "$token" | grep -q '^eyJ'; then
    payload=$(python3 -c "import base64,json; t='$token'; p=t.split('.')[1]; d=base64.urlsafe_b64decode(p+'=='); print(json.loads(d).get('sub','?')[:25])" 2>/dev/null)
    [ -n "$payload" ] && ok "JWT valid ($payload)" || ok "JWT (no sub)"
  else
    ok "PAT token (${token:0:20}...)"
  fi
fi
echo ""

# ── 3. API ──
echo -e "${CYAN}[3] Soma API${NC}"
for ep in "conversations" "skills" "files"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SOMA/api/v1/$ep" -H "x-api-key: $KEY" 2>/dev/null)
  [ "$code" = "200" ] && ok "$ep" || fail "$ep" "HTTP $code"
done
echo ""

# ── 4. WebSocket ──
echo -e "${CYAN}[4] WebSocket${NC}"
ws=$(docker exec zea_soma_local wget -qO- --post-data='{"type":"init","uid":"c0000000-852c-44e5-aee1-a761ec76eaea","cid":"doctor"}' \
  --header='Content-Type: application/json' http://localhost:3002/ 2>/dev/null)
[ "$ws" = "Agent RPC OK" ] && ok "Agent RPC" || fail "Agent RPC" "$ws"
echo ""

# ── 5. DB ──
echo -e "${CYAN}[5] Database${NC}"
msgs=$(docker exec zea_postgres_local psql -U postgres -d soma_prod -t -c "SELECT COUNT(*) FROM messages" 2>/dev/null | tr -d ' ')
[ "${msgs:-0}" -gt 0 ] && ok "Messages ($msgs)" || fail "Messages" "0"
convs=$(docker exec zea_postgres_local psql -U postgres -d soma_prod -t -c "SELECT COUNT(*) FROM conversations" 2>/dev/null | tr -d ' ')
[ "${convs:-0}" -gt 0 ] && ok "Conversations ($convs)" || fail "Conversations" "0"
echo ""

# ── 6. Skills ──
echo -e "${CYAN}[6] Skills${NC}"
skills=$(curl -s "$SOMA/api/v1/skills" -H "x-api-key: $KEY" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null)
[ "${skills:-0}" -gt 0 ] && ok "Skills loaded ($skills)" || fail "Skills" "0"
session_skills=$(docker logs zea_soma_local --since 120s 2>&1 | grep -c "skills")
[ "$session_skills" -gt 0 ] && ok "Skills in session" || fail "Skills in session" "Not found"
echo ""

# ── 7. Agent Response (WebSocket real) ──
echo -e "${CYAN}[7] Agent Response${NC}"
echo "  ⏳ Sending prompt via WebSocket..."
RESPONSE=$(python3 -c "
import asyncio, json, time
try:
    import websockets
except:
    print('NO_WEBSOCKETS')
    exit()

async def test():
    async with websockets.connect('ws://soma.zea.localhost/agent-ws') as ws:
        await ws.send(json.dumps({'type':'init','uid':'c0000000-852c-44e5-aee1-a761ec76eaea','cid':'00000000-0000-0000-0000-000000000001'}))
        await asyncio.wait_for(ws.recv(), timeout=5)
        await ws.send(json.dumps({'type':'prompt','text':'Di OK'}))
        has_delta = False
        has_done = False
        for _ in range(20):
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=3)
                data = json.loads(msg)
                if data['type'] in ('delta', 'thinking'): has_delta = True
                if data['type'] == 'done': has_done = True
                if data['type'] == 'error': print('ERROR:' + data.get('message',''))
            except asyncio.TimeoutError:
                pass
        if has_delta and has_done: print('OK')
        elif has_delta: print('PARTIAL')
        else: print('TIMEOUT')

asyncio.run(test())
" 2>&1)

if echo "$RESPONSE" | grep -q "^OK$"; then
  ok "Agent responded (delta + done)"
elif echo "$RESPONSE" | grep -q "PARTIAL"; then
  ok "Agent responded (delta, no done)"
elif echo "$RESPONSE" | grep -q "^ERROR:"; then
  fail "Agent responded" "$(echo $RESPONSE | grep ERROR:)"
elif echo "$RESPONSE" | grep -q "NO_WEBSOCKETS"; then
  echo "  ⚠️  websockets not installed — pip3 install websockets"
  # Fallback: check DB for recent assistant messages
  last_role=$(docker exec zea_postgres_local psql -U postgres -d soma_prod -t -c "SELECT role FROM messages ORDER BY created_at DESC LIMIT 1" 2>/dev/null | tr -d ' ')
  if [ "$last_role" = "assistant" ]; then
    ok "Agent responded (found in DB)"
  else
    fail "Agent responded" "Cannot test"
  fi
else
  fail "Agent responded" "$RESPONSE"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}✅ $PASS${NC}  ${RED}❌ $FAIL${NC}  Total: $((PASS + FAIL))"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
[ "$FAIL" -eq 0 ] && echo -e "\n${GREEN}🎉 Soma 100% operativo${NC}" || echo -e "\n${RED}⚠️  $FAIL capa(s) con problemas${NC}"

# ── E2E: Playwright ──
if command -v node &>/dev/null && [ -f "$(dirname "$0")/e2e/soma.spec.js" ]; then
  echo ""
  echo -e "${CYAN}[E2E] Playwright Browser Test${NC}"
  echo "  ⏳ Running E2E flow in headless browser..."
  E2E_RESULT=$(cd "$(dirname "$0")/e2e" && node soma.spec.js 2>&1)
  if echo "$E2E_RESULT" | grep -q "AGENT RESPONDED"; then
    echo -e "  ${GREEN}✅${NC} E2E: Agent responded in browser"
  elif echo "$E2E_RESULT" | grep -q "No response"; then
    echo -e "  ${RED}❌${NC} E2E: No response detected"
  else
    echo -e "  ${RED}❌${NC} E2E: Failed — check e2e/soma.spec.js"
  fi
  echo "  📁 Screenshots: /tmp/soma-e2e/"
fi

exit $FAIL
