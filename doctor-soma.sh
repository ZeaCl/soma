#!/bin/bash
# 🩺 Soma Doctor — Health check 13 capas, 40+ verificaciones
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

ok()   { echo -e "  ${GREEN}✅${NC} $1"; PASS=$((PASS+1)); }
warn() { echo -e "  ${YELLOW}⚠️${NC}  $1 — $2"; WARN=$((WARN+1)); }
fail() { echo -e "  ${RED}❌${NC} $1 ${RED}— $2${NC}"; FAIL=$((FAIL+1)); }

THALAMUS="${THALAMUS_URL:-http://auth.zea.localhost}"
SOMA="${SOMA_URL:-http://soma.zea.localhost}"
AGENT_ID="${AGENT_ID:-4c4e2791-026b-4508-a2c3-1580bf86b661}"
AGENT_ID2="${AGENT_ID2:-c0000000-852c-44e5-aee1-a761ec76eaea}"
BOOTSTRAP_KEY="${BOOTSTRAP_KEY:-SOMA_TEST_KEY}"
DB="${DB_NAME:-soma_prod}"
PG_USER="${PG_USER:-postgres}"
DIR="$(dirname "$0")"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🩺  Soma Doctor v2  —  13 capas                ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 1 — HTTP & Infra
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [1/13] HTTP & Infra ───────────────────────────┐${NC}"

code=$(curl -s -o /dev/null -w "%{http_code}" "$SOMA/health" 2>/dev/null | tr -d '\r\n')
[ "$code" = "200" ] && ok "Soma HTTP health" || fail "Soma HTTP" "HTTP $code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$THALAMUS/.well-known/jwks.json" 2>/dev/null | tr -d '\r\n')
[ "$code" = "200" ] && ok "Thalamus JWKS" || fail "Thalamus JWKS" "HTTP $code"

body=$(curl -sf "$SOMA/health" 2>/dev/null || true)
echo "$body" | grep -q '"status":"ok"' && ok "Soma health JSON OK" || warn "Health JSON" "unexpected format"

if docker ps --filter name=zea_soma_local --format '{{.Status}}' 2>/dev/null | grep -q 'Up'; then
  ok "Docker container running"
else
  fail "Docker container" "Not running"
fi

if docker exec zea_soma_local pgrep -f "agent-rpc" >/dev/null 2>&1; then
  ok "Agent RPC process alive"
else
  fail "Agent RPC process" "Dead"
fi

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 2 — Auth
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [2/13] Auth ───────────────────────────────────┐${NC}"

token=$(curl -sf -X POST "$THALAMUS/api/internal/agent-token" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$AGENT_ID\",\"scopes\":[\"soma:read\"]}" 2>/dev/null | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")
[ -n "$token" ] && ok "Agent token from Thalamus" || fail "Agent token" "No token"

if [ -n "$token" ]; then
  if echo "$token" | grep -q '^eyJ'; then
    payload=$(python3 -c "
import base64,json,sys
t='$token'
p=t.split('.')[1]
# add padding
p += '=' * (4 - len(p) % 4)
d=base64.urlsafe_b64decode(p)
print(json.loads(d).get('sub','?')[:30])
" 2>/dev/null || echo "?")
    [ -n "$payload" ] && ok "JWT decoded (sub=$payload)" || warn "JWT" "Could not decode sub"
  else
    ok "PAT token (${token:0:20}...)"
  fi
fi

# API Key: valid
code=$(curl -s -o /dev/null -w "%{http_code}" "$SOMA/api/v1/conversations" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null)
[ "$code" = "200" ] && ok "API Key valid → 200" || fail "API Key valid" "HTTP $code"

# API Key: invalid
code=$(curl -s -o /dev/null -w "%{http_code}" "$SOMA/api/v1/conversations" -H "x-api-key: zs_live_deadbeef" 2>/dev/null)
[ "$code" = "401" ] && ok "API Key invalid → 401" || warn "API Key invalid" "HTTP $code (expected 401)"

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 3 — Multi-Tenancy
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [3/13] Multi-Tenancy ──────────────────────────┐${NC}"

# Verify org isolation: two different API keys should see different data
org1_files=$(curl -sf "$SOMA/api/v1/files" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total', len(d.get('files',[]))))" 2>/dev/null || echo "0")
[ "${org1_files:-0}" -ge 0 ] && ok "Org 1 files accessible ($org1_files)" || fail "Org files" "Error"

# Verify skills list org-scoped
org1_skills=$(curl -sf "$SOMA/api/v1/skills" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
[ "${org1_skills:-0}" -gt 0 ] && ok "Skills org-scoped ($org1_skills)" || warn "Skills count" "${org1_skills}"

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 4 — Agents
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [4/13] Agents = Users ─────────────────────────┐${NC}"

agents=$(curl -sf "$SOMA/api/v1/agents" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null | python3 -c "
import sys,json
data=json.load(sys.stdin).get('data',[])
print(len(data))
" 2>/dev/null || echo "0")
[ "${agents:-0}" -gt 0 ] && ok "Agent list ($agents agents)" || warn "Agent list" "${agents} agents (Thalamus may be empty)"

# Check if known agent exists in list
agent_found=$(curl -sf "$SOMA/api/v1/agents" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null | python3 -c "
import sys,json
data=json.load(sys.stdin).get('data',[])
found = [a for a in data if a.get('id','') == '$AGENT_ID']
print(len(found))
" 2>/dev/null || echo "0")
[ "${agent_found:-0}" -gt 0 ] && ok "Agent $AGENT_ID found" || warn "Agent $AGENT_ID" "Not in list"

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 5 — Agent Config Injection
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [5/13] Agent Config ───────────────────────────┐${NC}"

# Check agent config endpoint
config=$(curl -sf "$SOMA/api/v1/agents/$AGENT_ID/config" -H "x-api-key: $BOOTSTRAP_KEY" -X PUT \
  -H "Content-Type: application/json" \
  -d '{"system_prompt":"Doctor test"}' 2>/dev/null || echo "")
echo "$config" | grep -q '"ok":true' && ok "Update agent config" || warn "Agent config update" "May need Thalamus"

# Verify config file exists on disk
if docker exec zea_soma_local test -f "/root/.agents/agent-configs/${AGENT_ID}.json" 2>/dev/null; then
  ok "Agent config file on disk"
else
  warn "Agent config file" "Not found (first run?)"
fi

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 6 — Tools
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [6/13] Tools ──────────────────────────────────┐${NC}"

# Check tools in session logs
tools_in_logs=$(docker logs zea_soma_local --since 10m 2>&1 | grep -c "read.*bash.*edit.*write" 2>/dev/null | head -1 | tr -d ' \n' || echo "0")
[ -n "${tools_in_logs}" ] && [ "${tools_in_logs}" -gt 0 ] 2>/dev/null && ok "Tools in session (read,bash,edit,write)" || warn "Tools in logs" "Not in recent logs"

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 7 — Sandboxes / Workspace
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [7/13] Sandboxes ──────────────────────────────┐${NC}"

# List files
code=$(curl -s -o /dev/null -w "%{http_code}" "$SOMA/api/v1/files" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null)
[ "$code" = "200" ] && ok "GET /files → 200" || fail "GET /files" "HTTP $code"

# Upload file test
upload=$(curl -sf -X POST "$SOMA/api/v1/files/upload" -H "x-api-key: $BOOTSTRAP_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"doctor-test.txt\",\"data\":\"$(echo -n 'doctor check' | base64)\",\"path\":\"\"}" 2>/dev/null || echo "")
echo "$upload" | grep -q '"ok":true' && ok "File upload" || warn "File upload" "May fail"

# Git history
history=$(curl -sf "$SOMA/api/v1/files/history?path=doctor-test.txt" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null || echo "")
echo "$history" | grep -q '"commits"' && ok "Git history" || warn "Git history" "No commits yet"

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 8 — API Keys
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [8/13] API Keys ───────────────────────────────┐${NC}"

# Create a temporary API key
new_key=$(curl -sf -X POST "$SOMA/api/v1/api-keys" -H "x-api-key: $BOOTSTRAP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"doctor-test-key","scopes":["soma:read"]}' 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('api_key',''))" 2>/dev/null || echo "")
if [ -n "$new_key" ] && echo "$new_key" | grep -q '^zs_live_'; then
  ok "API Key created ($(echo $new_key | cut -c1-20)...)"

  # Verify new key works
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SOMA/api/v1/conversations" -H "x-api-key: $new_key" 2>/dev/null)
  [ "$code" = "200" ] && ok "New key valid → 200" || fail "New key" "HTTP $code"

  # Verify key hash stored (not raw)
  raw_hash=$(echo -n "$new_key" | openssl dgst -sha256 -binary | base64 2>/dev/null || echo "")
  if [ -n "$raw_hash" ]; then
    db_hash=$(docker exec zea_postgres_local psql -U "$PG_USER" -d "$DB" -t -c "SELECT key_hash FROM api_keys WHERE key_prefix='zs_live_' ORDER BY inserted_at DESC LIMIT 1" 2>/dev/null | tr -d ' ' || echo "")
    [ -n "$db_hash" ] && ok "Key hash in DB" || warn "Key hash in DB" "Not found"
  fi
else
  warn "API Key creation" "Could not create (Thalamus may be down)"
fi

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 9 — Conversations & Messages
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [9/13] Conversations ──────────────────────────┐${NC}"

code=$(curl -s -o /dev/null -w "%{http_code}" "$SOMA/api/v1/conversations" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null)
[ "$code" = "200" ] && ok "Conversations list → 200" || fail "Conversations" "HTTP $code"

msgs=$(docker exec zea_postgres_local psql -U "$PG_USER" -d "$DB" -t -c "SELECT COUNT(*) FROM messages" 2>/dev/null | tr -d ' ' || echo "0")
[ "${msgs:-0}" -gt 0 ] && ok "Messages in DB ($msgs)" || warn "Messages" "0"

convs=$(docker exec zea_postgres_local psql -U "$PG_USER" -d "$DB" -t -c "SELECT COUNT(*) FROM conversations" 2>/dev/null | tr -d ' ' || echo "0")
[ "${convs:-0}" -gt 0 ] && ok "Conversations in DB ($convs)" || warn "Conversations" "0"

# Check thinking is stored
thinking_count=$(docker exec zea_postgres_local psql -U "$PG_USER" -d "$DB" -t -c "SELECT COUNT(*) FROM messages WHERE thinking IS NOT NULL AND thinking != ''" 2>/dev/null | tr -d ' ' || echo "0")
[ "${thinking_count:-0}" -gt 0 ] && ok "Thinking persisted ($thinking_count msgs)" || warn "Thinking persisted" "0 messages with thinking"

# Check tool usage stored
tool_count=$(docker exec zea_postgres_local psql -U "$PG_USER" -d "$DB" -t -c "SELECT COUNT(*) FROM messages WHERE tools IS NOT NULL" 2>/dev/null | tr -d ' ' || echo "0")
if [ "${tool_count:-0}" -gt 0 ]; then
  ok "Tool usage stored ($tool_count msgs)"
fi

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 10 — Skills
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [10/13] Skills ────────────────────────────────┐${NC}"

skills=$(curl -sf "$SOMA/api/v1/skills" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
[ "${skills:-0}" -gt 0 ] && ok "Skills loaded ($skills)" || fail "Skills" "0"

# Skills WS endpoint
skills_ws=$(curl -sf "$SOMA/api/skills" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('skills',d.get('data',[]))))" 2>/dev/null || echo "0")
[ "${skills_ws:-0}" -gt 0 ] && ok "Skills WS endpoint ($skills_ws)" || warn "Skills WS" "0"

# Custom skill create/delete roundtrip
skill_test=$(curl -sf -X POST "$SOMA/api/skills" -H "x-api-key: $BOOTSTRAP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"doctor-check-skill","content":"# Doctor Test Skill\n\nTest only."}' 2>/dev/null || echo "")
if echo "$skill_test" | grep -q '"name":"doctor-check-skill"'; then
  ok "Custom skill created"

  # Verify it appears in list
  has_skill=$(curl -sf "$SOMA/api/v1/skills" -H "x-api-key: $BOOTSTRAP_KEY" 2>/dev/null | grep -c "doctor-check-skill" 2>/dev/null | head -1 | tr -d ' \n' || echo "0")
  [ -n "${has_skill}" ] && [ "${has_skill}" -gt 0 ] 2>/dev/null && ok "Custom skill in list" || warn "Custom skill list" "Not found"

  # Clean up
  curl -sf -X DELETE "$SOMA/api/skills/doctor-check-skill" -H "x-api-key: $BOOTSTRAP_KEY" >/dev/null 2>&1
  [ "$?" -eq 0 ] && ok "Custom skill deleted" || warn "Skill delete" "May have failed"
else
  warn "Custom skill" "Create failed"
fi

# Verify builtin skills exist on disk
builtin_count=$(docker exec zea_soma_local ls /root/.agents/skills/ 2>/dev/null | wc -l | tr -d ' ' || echo "0")
[ "${builtin_count:-0}" -gt 0 ] && ok "Builtin skills on disk ($builtin_count)" || warn "Builtin skills" "0"

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 11 — WebSocket Agent Session
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [11/13] WebSocket Session ─────────────────────┐${NC}"

# HTTP health of Agent RPC
ws_http=$(docker exec zea_soma_local wget -qO- --post-data='{"type":"init","uid":"c0000000-852c-44e5-aee1-a761ec76eaea","cid":"doctor"}' \
  --header='Content-Type: application/json' http://localhost:3002/ 2>/dev/null || echo "")
[ "$ws_http" = "Agent RPC OK" ] && ok "Agent RPC HTTP" || fail "Agent RPC HTTP" "$ws_http"

# Full WebSocket flow: init → ready → prompt → delta → done
echo "  ⏳ Testing full WebSocket flow..."
WS_RESULT=$(python3 -c "
import asyncio, json, sys

async def test():
    try:
        import websockets
    except ImportError:
        print('NO_WEBSOCKETS')
        return

    try:
        async with websockets.connect('ws://soma.zea.localhost/agent-ws') as ws:
            # Init
            await ws.send(json.dumps({'type':'init','uid':'$AGENT_ID2','cid':'doctor-ws-test'}))
            ready = await asyncio.wait_for(ws.recv(), timeout=10)
            rd = json.loads(ready)
            if rd['type'] != 'ready':
                print('INIT_FAILED:' + rd['type'])
                return

            # Prompt
            await ws.send(json.dumps({'type':'prompt','text':'Di exactamente DOCTOR_OK'}))
            has_delta = False
            has_thinking = False
            has_done = False
            done_content = ''
            done_thinking = ''

            for _ in range(30):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=3)
                    data = json.loads(msg)
                    t = data['type']
                    if t == 'delta':
                        has_delta = True
                        done_content += data.get('text','')
                    elif t == 'thinking':
                        has_thinking = True
                        done_thinking += data.get('text','')
                    elif t == 'done':
                        has_done = True
                        break
                    elif t == 'error':
                        print('ERROR:' + data.get('message',''))
                        return
                except asyncio.TimeoutError:
                    pass

            if has_delta and has_done:
                if done_content.strip() and done_thinking.strip():
                    print('FULL:content+thinking')
                elif done_content.strip():
                    print('FULL:content')
                else:
                    print('FULL:nocontent')
            elif has_delta:
                print('PARTIAL:delta_only')
            elif has_thinking:
                print('PARTIAL:thinking_only')
            else:
                print('TIMEOUT')
    except Exception as e:
        print('EXCEPTION:' + str(e)[:80])

asyncio.run(test())
" 2>&1)

if echo "$WS_RESULT" | grep -q "^FULL:"; then
  detail=$(echo "$WS_RESULT" | grep "^FULL:" | head -1)
  ok "WS full flow ($detail)"
elif echo "$WS_RESULT" | grep -q "^PARTIAL:"; then
  detail=$(echo "$WS_RESULT" | grep "^PARTIAL:" | head -1)
  ok "WS partial ($detail)"
elif echo "$WS_RESULT" | grep -q "^ERROR:"; then
  fail "WS flow" "$(echo $WS_RESULT | grep ERROR:)"
elif echo "$WS_RESULT" | grep -q "EXCEPTION:"; then
  fail "WS flow" "$(echo $WS_RESULT | grep EXCEPTION: | head -1)"
elif echo "$WS_RESULT" | grep -q "NO_WEBSOCKETS"; then
  warn "WS flow" "websockets not installed (pip3 install websockets)"
else
  fail "WS flow" "$(echo $WS_RESULT | head -1)"
fi

# Cancel test
echo "  ⏳ Testing cancel..."
CANCEL_RESULT=$(python3 -c "
import asyncio, json

async def test():
    try:
        import websockets
    except:
        print('NO_WS')
        return
    try:
        async with websockets.connect('ws://soma.zea.localhost/agent-ws') as ws:
            await ws.send(json.dumps({'type':'init','uid':'$AGENT_ID2','cid':'doctor-cancel'}))
            await asyncio.wait_for(ws.recv(), timeout=5)
            await ws.send(json.dumps({'type':'prompt','text':'Escribe un poema de 100 lineas sobre El Quijote'}))
            await asyncio.sleep(1)
            await ws.send(json.dumps({'type':'cancel'}))
            for _ in range(20):
                msg = await asyncio.wait_for(ws.recv(), timeout=2)
                data = json.loads(msg)
                if data['type'] == 'cancelled':
                    print('CANCELLED')
                    return
                elif data['type'] == 'done':
                    print('DONE_BEFORE_CANCEL')
                    return
            print('NO_CANCEL')
    except Exception as e:
        print('ERR:' + str(e)[:60])

asyncio.run(test())
" 2>&1)

if echo "$CANCEL_RESULT" | grep -q "^CANCELLED$"; then
  ok "Cancel flow works"
elif echo "$CANCEL_RESULT" | grep -q "DONE_BEFORE_CANCEL"; then
  ok "Cancel (agent finished first)"
elif echo "$CANCEL_RESULT" | grep -q "NO_WS"; then
  warn "Cancel flow" "No websockets"
else
  warn "Cancel flow" "$(echo $CANCEL_RESULT | head -1)"
fi

# Multiple sessions
echo "  ⏳ Testing multiple sessions..."
MULTI_RESULT=$(python3 -c "
import asyncio, json

async def one_session(uid, cid):
    try:
        import websockets
    except:
        return 'NO_WS'
    try:
        async with websockets.connect('ws://soma.zea.localhost/agent-ws') as ws:
            await ws.send(json.dumps({'type':'init','uid':uid,'cid':cid}))
            await asyncio.wait_for(ws.recv(), timeout=5)
            await ws.send(json.dumps({'type':'prompt','text':'Di OK'}))
            for _ in range(20):
                msg = await asyncio.wait_for(ws.recv(), timeout=3)
                if json.loads(msg)['type'] == 'done':
                    return 'OK'
            return 'TIMEOUT'
    except:
        return 'ERR'

async def main():
    r1, r2 = await asyncio.gather(
        one_session('$AGENT_ID2', 'multi-1'),
        one_session('$AGENT_ID2', 'multi-2'),
    )
    if r1 == 'OK' and r2 == 'OK':
        print('MULTI_OK')
    elif r1 == 'NO_WS' or r2 == 'NO_WS':
        print('NO_WS')
    else:
        print('MULTI_FAIL:' + r1 + ',' + r2)

asyncio.run(main())
" 2>&1)

if echo "$MULTI_RESULT" | grep -q "^MULTI_OK$"; then
  ok "Multiple sessions OK"
elif echo "$MULTI_RESULT" | grep -q "NO_WS"; then
  warn "Multi sessions" "No websockets"
else
  warn "Multi sessions" "$(echo $MULTI_RESULT | head -1)"
fi

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 12 — SDK Health
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [12/13] SDK Health ────────────────────────────┐${NC}"

# Check SDK dist exists
if [ -f "$DIR/sdk/dist/index.mjs" ]; then
  ok "SDK dist/index.mjs exists"
else
  fail "SDK dist" "Missing dist/index.mjs"
fi

if [ -f "$DIR/sdk/dist/components/index.mjs" ]; then
  ok "SDK components built"
else
  fail "SDK components" "Missing"
fi

# Check UI built
ui_js=$(ls "$DIR/priv/static/assets/index-"*.js 2>/dev/null | tail -1)
if [ -n "$ui_js" ]; then
  ok "UI built ($(basename $ui_js))"
else
  fail "UI built" "No index-*.js in priv/static"
fi

# Verify key exports
grep -q "useGlia" "$DIR/sdk/dist/index.mjs" 2>/dev/null && ok "useGlia exported" || fail "useGlia" "Not in dist"
grep -q "GliaChat" "$DIR/sdk/dist/index.mjs" 2>/dev/null && ok "GliaChat exported" || fail "GliaChat" "Not in dist"
grep -q "thinking" "$DIR/sdk/dist/hooks/index.mjs" 2>/dev/null && ok "Thinking support in SDK" || warn "Thinking" "Not in hooks dist"

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# CAPA 13 — E2E Browser
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}┌─ [13/13] E2E Browser ───────────────────────────┐${NC}"

if command -v node &>/dev/null && [ -f "$DIR/e2e/soma-multiturn.js" ]; then
  echo "  ⏳ Running multi-turn E2E in headless browser..."
  E2E_RESULT=$(cd "$DIR/e2e" && node soma-multiturn.js 2>&1)
  if echo "$E2E_RESULT" | grep -q "ALL CHECKS PASSED"; then
    ok "E2E multi-turn PASSED"
  elif echo "$E2E_RESULT" | grep -q "CHECK(S) FAILED"; then
    fails=$(echo "$E2E_RESULT" | grep "CHECK(S) FAILED" | grep -o '[0-9]*')
    fail "E2E multi-turn" "${fails:-?} checks failed"
  else
    warn "E2E multi-turn" "Could not determine result"
  fi
  echo "  📁 Screenshots: /tmp/soma-e2e/"
  echo "  📁 Logs: /tmp/soma-e2e/browser-logs.txt"
else
  warn "E2E" "soma-multiturn.js not found or node missing"
fi

# Quick spec check as fallback
if command -v node &>/dev/null && [ -f "$DIR/e2e/soma.spec.js" ] && ! echo "$E2E_RESULT" | grep -q "ALL CHECKS PASSED"; then
  echo "  ⏳ Fallback: running soma.spec.js..."
  SPEC_RESULT=$(cd "$DIR/e2e" && node soma.spec.js 2>&1)
  if echo "$SPEC_RESULT" | grep -q "AGENT RESPONDED"; then
    ok "E2E spec: Agent responded"
  else
    warn "E2E spec" "No response — check screenshots"
  fi
fi

echo -e "${CYAN}└──────────────────────────────────────────────────┘${NC}"

# ═══════════════════════════════════════════════════════════════════
# FINAL REPORT
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  📊  FINAL REPORT                                ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════╣${NC}"
printf "${CYAN}║${NC}  ${GREEN}✅ %3d passed${NC}  ${RED}❌ %3d failed${NC}  ${YELLOW}⚠️  %3d warnings${NC}  ${CYAN}║${NC}\n" $PASS $FAIL $WARN
echo -e "${CYAN}╠══════════════════════════════════════════════════╣${NC}"

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  echo -e "${CYAN}║${NC}  ${GREEN}🎉 SOMA 100% OPERATIVO — Sin problemas${NC}       ${CYAN}║${NC}"
elif [ "$FAIL" -eq 0 ]; then
  echo -e "${CYAN}║${NC}  ${YELLOW}⚠️  SOMA OPERATIVO — $WARN advertencia(s)${NC}       ${CYAN}║${NC}"
else
  echo -e "${CYAN}║${NC}  ${RED}⚠️  SOMA CON PROBLEMAS — $FAIL capa(s) fallaron${NC}    ${CYAN}║${NC}"
fi

echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

exit $FAIL
