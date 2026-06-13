# Soma AgentHub v2 — Test Matrix (Requirements-Matched)

> Cada caso de prueba mapea a un requirement específico.  
> Cada edge case del documento de requirements tiene su test.  
> Cada criterio de aceptación es verificable objetivamente.

```
🔬 Métodos — D=Doctor  E=E2E Playwright  W=WebSocket  U=Unit(mix test)  A=API curl  K=CLI  B=Bash  M=Manual
```

---

## R1 — Multi-Engine Agent Sessions (8 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R1-T1 | Pi engine crea sesión | R1.1 | W | `EngineRegistry.get('pi').createSession(config)` → session.prompt("Di OK") → delta "OK" → done | ✅ |
| R1-T2 | ReAct engine registrado | R1.2 | U | `EngineRegistry.get('react')` no es nil, `createSession()` lanza Error('not implemented') | ✅ |
| R1-T3 | OpenCode engine registrado | R1.3 | U | `EngineRegistry.get('opencode')` no es nil | ✅ |
| R1-T4 | Agente sin engine → default pi | R1.4 | W | init con config sin campo `engine` → sesión creada con PiEngine | ✅ |
| R1-T5 | Engine desconocido → error | R1.5 | W | init con `engine: "unknown"` → `{type:"error", message:"Unknown engine: unknown"}` | ❌ |
| R1-T6 | 2 agentes simultáneos distinto engine | R1.6 | W | Agente-A con pi + Agente-B con react → ambos reciben ready sin interferencia | ✅ |
| R1-T7 | Registrar engine en runtime | R1.7 | U | `EngineRegistry.register('nuevo', stub)` → `.get('nuevo')` disponible inmediatamente | ✅ |
| R1-T8 | Engine crashea → servidor no muere | R1.8 | W | Engine.createSession() lanza excepción → `{type:"error"}` al cliente, WebSocket sigue abierto | ✅ |
| R1-E1 | Edge: engine no registrado al iniciar | R1.5 | D | `docker logs | grep "Engine registered"` = 5 engines | ✅ |

## R2 — OS-Level Sandboxes (10 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R2-T1 | `useradd` crea usuario Linux | R2.1 | B | `id soma-{id}` retorna UID > 0, home en `/home/soma/{id}` | ❌ |
| R2-T2 | Home con `chmod 700` | R2.2 | B | `stat -c "%a" /home/soma/{id}` = `700` | ❌ |
| R2-T3 | Agente A no lee home de B | R2.3 | B | `sudo -u soma-A cat /home/soma/B/x` → `Permission denied` | ❌ |
| R2-T4 | Tools ejecutan con `sudo -u` | R2.4 | B | Agente ejecuta `touch /home/soma/{id}/workspace/x` → owner es `soma-{id}` | ❌ |
| R2-T5 | Bind mount volumen compartido | R2.5 | B | `mount \| grep /home/soma/{id}/shared` muestra el bind | ❌ |
| R2-T6 | Mount read-only bloquea escritura | R2.6 | B | `sudo -u soma-{id} touch /home/.../ro-mount/x` → `Read-only file system` | ❌ |
| R2-T7 | `userdel -r` destruye sandbox | R2.7 | B | Después de destroy: `id soma-{id}` falla, home no existe, mounts desmontados | ❌ |
| R2-T8 | Grupos Linux para equipos | R2.8 | B | `groups soma-{id}` incluye `org-{orgId}` y `team-{team}` | ❌ |
| R2-T9 | Agentes misma org comparten volumen | R2.9 | B | Agente A y B mismo grupo → ambos pueden `touch /shared/x` | ❌ |
| R2-T10 | Chroot restringe al home | R2.10 | B | `sudo chroot /home/soma/{id} ls /etc` → solo ve archivos dentro del chroot | ❌ |
| R2-E1 | Edge: `useradd` falla → rollback | R2.1 | B | Script useradd falla → no deja usuario parcial, limpia directorios | ❌ |
| R2-E2 | Edge: mount source no existe → skip | R2.5 | B | Mount con source inexistente → warn en log, agente creado sin ese mount | ❌ |
| R2-E3 | Edge: nombre duplicado → UUID suffix | R2.1 | B | 2 agentes mismo nombre → `soma-{id1}` y `soma-{id2}`, sin colisión | ❌ |

## R3 — CLI soma-agent (10 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R3-T1 | `--help` muestra todos los comandos | R3.1 | K | Output contiene "agent", "skill", "workspace", "engine", "conversation", "doctor", "auth" | ✅ |
| R3-T2 | `engine list` muestra 5 engines | R3.1 | K | Output: "pi ✅ Ready", "react 🚧", "opencode 🚧", "hermes 🚧", "goose 🚧" | ✅ |
| R3-T3 | `skill list` con API key | R3.1 | K | Output: tabla con NAME, TYPE (builtin/custom), DESCRIPTION. Total > 0 | ✅ |
| R3-T4 | `doctor run` ejecuta health check | R3.7 | K | Exit 0, output contiene "FINAL REPORT" y "passed" | ✅ |
| R3-T5 | `auth whoami` verifica sesión | R3.1 | K | Con API key → "✅ Authenticated — N conversations". Sin key → error claro | ✅ |
| R3-T6 | `workspace list` muestra archivos | R3.1 | K | Output con 📄/📁 + nombres + tamaños. `workspace upload ./file` → confirmación | ✅ |
| R3-T7 | `engine info pi` muestra descripción | R3.1 | K | Output: "🥧 Pi Engine", "Runtime: @earendil-works/pi", "Status: ✅ Ready" | ✅ |
| R3-T8 | Sin auth → mensaje claro | R3.9 | K | `soma-agent skill list` sin SOMA_API_KEY → "⚠️ Not authenticated. Run: soma-agent auth login", exit 1 | ✅ |
| R3-T9 | `--json` flag | R3.8 | K | `soma-agent --json engine list` → output es JSON parseable | ✅ |
| R3-T10 | `agent create` mock | R3.1 | A | `POST /api/v1/agents` → 201, body contiene agent ID | ⚠️ Thalamus |
| R3-E1 | Edge: `--ttl 1h` auto-destruye | R3.10 | K | Agente creado con --ttl 1h → background job lo destruye a la hora | ❌ |
| R3-E2 | Edge: `agent create` sin --name → error | R3.1 | K | `soma-agent agent create` sin flags → "❌ --name is required", exit 1 | ✅ |

## R4 — Agent Configuration Injection (6 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R4-T1 | Config desde Thalamus | R4.1 | W | init → `getAgentConfig()` llama a Thalamus → system_prompt, skills, tools, engine inyectados | ✅ |
| R4-T2 | Fallback a archivo local | R4.2 | W | Thalamus caído → usa `/root/.agents/agent-configs/{userId}.json` | ✅ |
| R4-T3 | Tools configurables (no hardcode) | R4.4 | W | Config con `tools: ["read"]` → session solo tiene tool read. No edit/write | ✅ |
| R4-T4 | `skillsVersion` se incrementa | R4.5 | W | PUT /agents/:id/config → siguiente init usa config fresca (cache invalidada) | ⚠️ |
| R4-T5 | Skill inexistente → skip + warn | R4.6 | W | Config pide skill "no-existe" → log warning, sesión creada sin esa skill | ✅ |
| R4-T6 | Workspace paths inyectados | R4.3 | W | Config con `workspace_paths: ["/ws/org-1/app"]` → agente puede leer archivos de ese path | ⚠️ |
| R4-E1 | Edge: Thalamus cae, sin archivo local | R4.2 | W | Sin Thalamus y sin archivo → usa `buildFallbackPrompt(userId)` + todas las skills del FS | ✅ |

## R5 — SDK Portability (8 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R5-T1 | Solo peer deps react + react-dom | R5.1 | U | `npm install @zea/soma-sdk` en proyecto limpio → solo instala react/react-dom | ✅ |
| R5-T2 | CSS standalone sin zea-design | R5.2 | M | `import 'base.css'` → GliaChat renderiza correctamente sin `zea-design.css` cargado | ✅ |
| R5-T3 | `wsPath` configurable | R5.3 | U | `useGlia({wsPath:"/custom"})` → `wsUrl` termina en `/custom`, no `/agent-ws` | ✅ |
| R5-T4 | `authHeaders` factory | R5.4 | U | `authHeaders:()=>({Auth:"X"})` → request incluye `Auth: X` en vez de `x-api-key` | ✅ |
| R5-T5 | `apiPrefix` configurable | R5.5 | U | `apiPrefix:"/api/v2"` → hooks llaman `/api/v2/conversations` | ✅ |
| R5-T6 | Fallback `--glia-*` CSS vars | R5.6 | M | Sin `--zea-*` definidas → usa `--glia-*` del base.css | ✅ |
| R5-T7 | `SandboxProvider` custom | R5.7 | U | `MemorySandboxProvider.writeFile("x","y")` → `readFile("x")` retorna "y" | ✅ |
| R5-T8 | `agentConfig` directo (sin identity) | R5.8 | U | `<GliaChat agentConfig={{systemPrompt:"H"}} />` → no llama a Thalamus | ✅ |
| R5-E1 | Edge: npm pack produce tarball | R5.1 | U | `npm pack` en sdk/ → `zea-soma-sdk-0.1.0.tgz` contiene dist/ + styles/ | ✅ |

## R6 — Landing Page & Developer Experience (6 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R6-T1 | Hero con terminal preview | R6.1 | E | Página carga → h1 visible, "soma-agent" en texto, "Agent created" + "Linux user" visibles | ⚠️ |
| R6-T2 | "How it Works" visible al scrollear | R6.2 | E | Scroll 800px → "How it works" heading, "Agent = Linux User", "chmod 700" cards | ⚠️ |
| R6-T3 | "For Developers" con CLI + CI/CD | R6.3 | E | Scroll → "soma-agent" comandos, ejemplo CI/CD con "ephemeral agent" | ⚠️ |
| R6-T4 | "For Companies" con filesystem | R6.4 | E | Scroll → "drwx------", "/home/soma/", "Permission denied" en texto | ⚠️ |
| R6-T5 | Multi-Engine cards | R6.5 | E | Scroll → "Pi ✅ Ready", "ReAct 🚧 Coming soon", "OpenCode 🚧" | ⚠️ |
| R6-T6 | CTA redirige a OAuth2 | R6.6 | E | Click "Launch AgentHub" → URL contiene "login" o "authorize" | ✅ |
| R6-E1 | Edge: página carga sin JS → mensaje | R6.1 | M | `<noscript>` muestra mensaje de "requires JavaScript" | ❌ |

## R7 — Multi-Tenancy & API Keys (5 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R7-T1 | API key resuelve org | R7.1 | U | Request con `x-api-key: zs_live_xxx` → `conn.assigns.org_id` poblado | ✅ |
| R7-T2 | API key inválida → 401 | R7.2 | U | `curl -H "x-api-key: zs_live_dead" /api/v1/conversations` → 401 `{"error":"unauthorized"}` | ✅ |
| R7-T3 | Skills aisladas por org | R7.3 | A | Org A crea skill "x" → Org B lista skills → "x" NO aparece | ⚠️ |
| R7-T4 | Files aislados por org | R7.4 | A | Org A upload a /files → contenido en `/workspace/orgs/{A}/` → Org B no puede listarlo | ✅ |
| R7-T5 | API key scope insuficiente → 403 | R7.5 | A | Key con `["soma:read"]` → `POST /api/skills` → 403 | ❌ |
| R7-E1 | Edge: API key sin org → 401 | R7.1 | U | Key sin organization_id → 401 | ✅ |

## R8 — Conversations & Thinking Persistence (6 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R8-T1 | User message persistido en DB | R8.1 | D | `SELECT COUNT(*) FROM messages WHERE role='user'` > 0 | ✅ |
| R8-T2 | Assistant message con thinking en DB | R8.2 | D | `SELECT COUNT(*) FROM messages WHERE role='assistant' AND thinking IS NOT NULL` > 0 | ✅ |
| R8-T3 | Mensajes en orden cronológico | R8.3 | U | `GET /api/conversations/:id` → messages ordenados por `created_at ASC` | ✅ |
| R8-T4 | Thinking visible en UI post-done | R8.4 | E | `.glia-thinking-persisted` count ≥ 1 después de done | ✅ |
| R8-T5 | Thinking toggle expande/colapsa | R8.5 | E | Click en botón thinking → contenido visible. Segundo click → oculto | ✅ |
| R8-T6 | Soft delete oculta sin borrar | R8.6 | U | `DELETE /api/conversations/:id` → 200. `GET /api/conversations` → no incluye. DB preserva registros | ✅ |
| R8-E1 | Edge: conversación vacía → mensaje welcome | R8.1 | E | Sin mensajes → feed muestra welcomeMessage | ✅ |
| R8-E2 | Edge: multi-turn conserva thinking de ambos | R8.4 | E | 2 turnos → `.glia-thinking-persisted` count = 2 | ✅ |

## R9 — Skills Management (5 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R9-T1 | Crear skill → DB + archivo | R9.1 | U | `POST /api/skills {name:"x", content:"# Test"}` → 201, SKILL.md en `/app/.pi-agent-skills/x/` | ✅ |
| R9-T2 | Skill custom sobreescribe builtin | R9.2 | A | Skill "xlsx" custom → `GET /api/skills/xlsx` retorna `source:"custom"`, contenido es el custom | ⚠️ |
| R9-T3 | Auto-discovery skill nueva | R9.3 | D | Nueva dir en `/app/.pi-agent-skills/nueva/` → watcher detecta, registra, log "Nueva skill detectada" | ✅ |
| R9-T4 | Asignar skill a agente → sync | R9.4 | A | `PUT /api/skills/x/agents {agentIds:["y"]}` → Thalamus recibe actualización | ⚠️ |
| R9-T5 | Skills version se incrementa | R9.5 | D | Watcher detecta cambio → `skillsVersion++` → cache invalidada | ✅ |
| R9-E1 | Edge: skill duplicada → 409 | R9.1 | A | `POST /api/skills {name:"existe"}` → 409 `{"error":"Skill already exists"}` | ✅ |
| R9-E2 | Edge: skill delete → archivo borrado | R9.1 | A | `DELETE /api/skills/x` → 204, archivo SKILL.md eliminado | ✅ |

## R10 — Testing & Quality Assurance (12 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R10-T1 | Unit tests Elixir → 0 failures | R10.1 | U | `mix test` → 22 tests, 0 failures | ✅ |
| R10-T2 | Integration tests API | R10.2 | U | Files CRUD, Skills CRUD, API keys, Conversations → todos pasan | ✅ |
| R10-T3 | E2E Playwright headless | R10.3 | E | `node soma-multiturn.js` → "ALL CHECKS PASSED" | ✅ |
| R10-T4 | Screenshot en fallo | R10.4 | E | Test falla → screenshot en `/tmp/soma-e2e/` | ✅ |
| R10-T5 | Browser console logs | R10.5 | E | Test completa → `browser-logs.txt` con logs `[useGlia]` | ✅ |
| R10-T6 | E2E valida thinking + persistencia | R10.6 | E | Verifica: thinking block, text response, 5s persist, toggle | ✅ |
| R10-T7 | E2E valida multi-turn | R10.7 | E | Verifica: 4 mensajes, ambos thinking, 0 lost warnings | ✅ |
| R10-T8 | Doctor 13 capas → exit 0 | R10.8 | D | `./doctor-soma.sh` → "0 failed" (warnings no cuentan como fail) | ✅ |
| R10-T9 | WS test reporta evento faltante | R10.9 | W | Test falla → output: "INIT_FAILED:error" o "PARTIAL:thinking_only" | ✅ |
| R10-T10 | Unit test sandbox mock | R10.10 | U | Test de `Sandbox.create` → mock verifica que `useradd` se llamó con params correctos | ❌ |
| R10-T11 | Integration test engine registry | R10.11 | W | Doctor WebSocket test → `FULL:content+thinking` | ✅ |
| R10-T12 | Doctor reporta capa + expected vs actual | R10.12 | D | Fallo en doctor → output: "❌ Skills — 0" (capa + valor) | ✅ |

## R11 — Workspace & Files API (8 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R11-T1 | Upload → git commit | R11.1 | U | `POST /files/upload` → archivo creado, `git log` muestra commit "write: {path}" | ✅ |
| R11-T2 | Delete → git rm | R11.2 | U | `DELETE /files?path=x` → archivo borrado, `git log` muestra "delete: {path}" | ✅ |
| R11-T3 | History → commits | R11.3 | U | `GET /files/history?path=x` → `commits` array con hash + message, length ≥ 1 | ✅ |
| R11-T4 | Recover → checkout | R11.4 | U | `POST /files/recover {path, commit}` → archivo vuelve al contenido de ese commit | ✅ |
| R11-T5 | Dir no vacío → error | R11.5 | U | `DELETE /files?path=dir-con-archivos` → `{"error":"directory_not_empty"}` | ✅ |
| R11-T6 | Path traversal bloqueado | R11.6 | U | `Workspace.resolve(org, "../../etc/passwd")` → `{:error, :path_traversal}` | ✅ |
| R11-T7 | Push → git push | R11.7 | U | `POST /files/push` → ejecuta `git push`, retorna output o `:not_configured` | ✅ |
| R11-T8 | AGENTS.md context | R11.8 | M | `Skills.load_app_context(org, app)` → contenido de AGENTS.md con referencias resueltas | ⚠️ |
| R11-E1 | Edge: git repo corrupto → error sin crash | R11.3 | U | `.git` corrupto → `history` retorna error, no crashea | ❌ |
| R11-E2 | Edge: recover con hash inválido → error | R11.4 | U | `recover` con hash inexistente → `{:error, msg}` | ❌ |

## R12 — WebSocket Session Lifecycle (6 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R12-T1 | Reconexión reanuda sesión | R12.1 | W | Cliente desconecta → reconecta con mismo cid → sesión existente (mensajes previos accesibles) | ✅ |
| R12-T2 | Cancel → abort + persistencia parcial | R12.2 | W | Prompt largo → cancel a los 2s → `{type:"cancelled"}`, mensaje parcial con "⏹️ Cancelado" | ✅ |
| R12-T3 | Sesiones simultáneas independientes | R12.3 | W | 2 WebSockets con distinto agentId → prompts paralelos sin interferencia | ✅ |
| R12-T4 | Prompt antes de ready → encolado | R12.4 | W | `send(prompt)` antes de recibir ready → prompt se envía automáticamente al recibir ready | ✅ |
| R12-T5 | WS close → isConnected=false | R12.5 | W | Cerrar WebSocket → `isConnected` = false, log "[useGlia] ws closed" | ✅ |
| R12-T6 | Engine error → mensaje al cliente | R12.6 | W | Engine lanza error durante prompt → `{type:"error", message:"..."}` al cliente, servidor sigue | ✅ |
| R12-E1 | Edge: múltiples prompts mientras streamea | R12.2 | W | 2 prompts rápidos → segundo es ignorado o encolado, no intercala respuestas | ✅ |

## R13 — Auth & Identity Service (8 criterios)

| ID | Caso | Req | Método | Criterio de aceptación | Estado |
|----|------|-----|--------|------------------------|--------|
| R13-T1 | JWT validado contra JWKS | R13.1 | A | `curl -H "Authorization: Bearer {jwt}" /api/conversations` → 200, `conn.assigns.user_id` poblado | ✅ |
| R13-T2 | JWKS caído → 401 | R13.2 | A | JWKS unreachable → request con JWT → 401 | ✅ |
| R13-T3 | PAT token validado | R13.3 | D | Doctor capa 2: "PAT token (th_pat_live_...)" | ✅ |
| R13-T4 | `domain_roles` → org_id | R13.4 | A | JWT con `domain_roles: [{org_id:"org-1"}]` → `conn.assigns.org_id` = "org-1" | ✅ |
| R13-T5 | `x-zea-org-id` override | R13.5 | A | Header `x-zea-org-id: org-2` + JWT domain_roles org-1 → org_id = "org-2" | ✅ |
| R13-T6 | Sin org_id → 401 | R13.6 | A | JWT sin domain_roles ni header → 401 | ✅ |
| R13-T7 | `authHeaders` factory en SDK | R13.7 | U | `authHeaders:()=>({Auth:"X"})` → fetch incluye `Auth: X` | ✅ |
| R13-T8 | authHeaders error → onAuthError | R13.8 | U | `authHeaders` lanza excepción → `onAuthError` llamado, request cancelado | ✅ |

---

## Resumen por Requirement

```
Req   Área                                   Casos  ✅  ⚠️  ❌   Cobertura
────  ─────────────────────────────────────  ─────  ──  ──  ──  ────────
R1    Multi-Engine Sessions                    9    8   0   1    89%
R2    OS-Level Sandboxes                      13    0   0  13     0%
R3    CLI soma-agent                          12   10   1   1    83%
R4    Agent Configuration Injection            7    5   2   0    71%
R5    SDK Portability                          9    9   0   0   100%
R6    Landing Page & DX                        7    1   5   1    14%
R7    Multi-Tenancy & API Keys                 6    4   1   1    67%
R8    Conversations & Thinking                 8    8   0   0   100%
R9    Skills Management                        7    5   2   0    71%
R10   Testing & Quality Assurance             12   10   0   2    83%
R11   Workspace & Files API                   10    8   1   1    80%
R12   WebSocket Session Lifecycle              7    7   0   0   100%
R13   Auth & Identity Service                  8    8   0   0   100%
──────────────────────────────────────────  ────  ──  ──  ──  ────────
TOTAL                                        115   83  12  20    72%
```

```
🟢 83 verdes   — Pasan (unit, E2E, doctor, WebSocket, CLI)
🟡 12 amarillos — Implementado sin test automático (Thalamus, landing render)
🔴 20 rojos     — OS Sandboxes (13, requiere Linux root) + gaps menores (7)
```

## Cómo correr todo

```bash
# 1. Unit + Integration (22 tests, R10)
DATABASE_URL=postgresql://...:5432/soma_test MIX_ENV=test mix test

# 2. E2E Playwright — browser (R8, R10, R12)
cd e2e && node soma-multiturn.js      # Multi-turn + thinking
cd e2e && node soma-cancel.js         # Cancel mid-stream
cd e2e && node soma-multi-agent.js    # Agent switch

# 3. Doctor — 13 capas (R10)
./doctor-soma.sh

# 4. CLI — terminal (R3)
SOMA_API_KEY=zs_live_xxx ./scripts/soma-agent engine list
SOMA_API_KEY=zs_live_xxx ./scripts/soma-agent skill list
SOMA_API_KEY=zs_live_xxx ./scripts/soma-agent doctor run

# 5. WebSocket directo (R1, R4, R12)
python3 -c "..."  # embedded en doctor-soma.sh

# 6. SDK build (R5)
cd sdk && npm run build

# 7. OS Sandboxes — requiere Linux con root (R2)
sudo ./scripts/soma-agent-useradd agent-id org-id
```
