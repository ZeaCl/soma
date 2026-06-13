# Implementation Plan — Soma AgentHub v2

## Overview

6 sprints, ~30 días de desarrollo. Cada tarea referencia los requirements que cubre. Tareas sin dependencias son paralelizables. El orden respeta: Fundación → Runtime → CLI/API → SDK → UI → Testing.

---

## Sprint 1: Engine Registry + OS Sandbox Core (Días 1-5)

**Objetivo:** Multi-engine funcionando. Agentes creados como usuarios Linux con kernel isolation.

| ID | Tarea | Dep | Días | Criterio de aceptación |
|----|-------|-----|------|------------------------|
| T-01 | Crear `server/engines/types.ts` — `AgentEngine`, `AgentSession`, `StreamEvent`, `AgentConfig` | — | 0.5 | Interfaces TypeScript compilan. `AgentEngine.name`, `.createSession()` definidos |
| T-02 | Crear `server/engines/registry.ts` — `EngineRegistry.register()`, `.get()`, `.list()` | — | 0.5 | `register('pi', PiEngine)` → `.get('pi')` retorna PiEngine. `.get('unknown')` retorna undefined |
| T-03 | Crear `server/engines/pi-engine.ts` — extraer `createAgentSession` de `agent-rpc.ts` | T-01 | 1 | `PiEngine.createSession(config)` crea sesión Pi. Subscribe emite eventos en formato `StreamEvent`. Test: WebSocket init → ready → prompt → delta → done |
| T-04 | Crear stubs: `react-engine.ts`, `opencode-engine.ts`, `hermes-engine.ts`, `goose-engine.ts` | T-01 | 0.5 | Cada stub implementa `AgentEngine`. `createSession()` lanza `Error('not implemented')`. Registry los registra sin crash |
| T-05 | Refactor `agent-rpc.ts` — usar `EngineRegistry` en `ws.on('init')` | T-02, T-03 | 1 | Leer `config.engine`, resolver engine, crear session. Default `pi`. Unknown engine → `{type:"error"}`. Test: 2 agentes con distinto engine inician OK |
| T-06 | Crear `scripts/soma-agent-useradd` — script bash de creación de usuario Linux | — | 1 | `useradd soma-{id}` con home, grupos, chmod 700. Mounts bind. Test manual: script crea usuario real, `sudo -u soma-{id} ls /home/soma/{id}` funciona |
| T-07 | Crear `scripts/soma-agent-userdel` — script bash de destrucción | — | 0.5 | `userdel -r`, `umount` de binds. Test: después de destruir, `id soma-{id}` falla, home no existe |
| T-08 | Crear `lib/soma/sandbox.ex` — módulo Elixir que wrappea scripts | T-06, T-07 | 1 | `Sandbox.create(agent_id, org_id, mounts)` → ejecuta script, retorna `{:ok, uid, home}`. `Sandbox.destroy(agent_id)` → `{:ok}`. Errores capturados |
| T-09 | Adaptar `server/engines/pi-engine.ts` para `sudo -u` en executeTool | T-03, T-06 | 1 | `bash`, `edit`, `write`, `read` ejecutan con `sudo -u soma-{id}`. Archivos creados tienen owner correcto. Test: crear archivo como agente → `ls -la` muestra uid del agente |
| T-10 | Agregar campo `engine` a `fetchAgentConfig()` — leer de Thalamus y archivo local | T-05 | 0.5 | `agent_config.engine` de Thalamus → usado por `EngineRegistry.get()`. Archivo local `config.json` también soporta `engine` |

---

## Sprint 2: Agent Runtime — Config + Session (Días 6-10)

**Objetivo:** Configuración de agentes completa. WebSocket session lifecycle robusto.

| ID | Tarea | Dep | Días | Criterio de aceptación |
|----|-------|-----|------|------------------------|
| T-11 | Implementar `PUT /api/agents/:id/config` con soporte para `engine`, `tools`, `system_prompt`, `skills`, `mounts` | T-10 | 1 | `curl -X PUT ... -d '{"engine":"react"}'` → 200. Siguiente init usa ReAct. `skillsVersion` se incrementa |
| T-12 | Implementar tools configurables — leer `config.tools` en vez de hardcode `['read','bash','edit','write']` | T-05, T-11 | 1 | Agente con `tools: ["read"]` solo puede leer. Agente con `tools: ["read","bash","edit","write"]` tiene acceso completo |
| T-13 | Implementar `POST /api/agents` — crear agente en Thalamus + config inicial | T-11 | 1 | `curl -X POST ... -d '{"name":"X","engine":"pi","tools":[...]}'` → 201 con agent ID |
| T-14 | Implementar `DELETE /api/agents/:id` — soft-delete + cleanup opcional | T-08 | 0.5 | 200. Agente ya no aparece en lista. Sandbox opcionalmente destruido |
| T-15 | Implementar reconexión de sesión WebSocket | T-05 | 0.5 | Cliente desconecta, reconecta con mismo `cid` → `SessionManager.continueRecent` reanuda. Mensajes no se pierden |
| T-16 | Implementar cola de prompts pendientes (`pendingRef`) | T-05 | 0.5 | Prompt enviado antes de `ready` → encolado. Al recibir `ready` → flush en orden. Test: send("msg1"), send("msg2") antes de ready → ambas enviadas en orden |
| T-17 | Implementar cancel robusto — `session.abort()` + `{type:"cancelled"}` + persistencia parcial | T-05 | 0.5 | Cancel durante streaming → `{type:"cancelled"}`. Contenido parcial persistido con "⏹️ Cancelado". Thinking parcial también persistido |
| T-18 | Agregar error handling en engine — crash no tira el servidor | T-05 | 0.5 | Engine lanza excepción → `{type:"error", message:"..."}` al cliente. WebSocket sigue abierto. Siguiente prompt funciona |

---

## Sprint 3: CLI + API Endpoints (Días 11-15)

**Objetivo:** `soma-agent` funcional. Todos los endpoints REST nuevos implementados.

| ID | Tarea | Dep | Días | Criterio de aceptación |
|----|-------|-----|------|------------------------|
| T-19 | Crear `scripts/soma-agent` — entry point con dispatch de subcomandos + auth | — | 0.5 | `soma-agent` sin args muestra help. `soma-agent agent` delega a commands/agent.sh |
| T-20 | Crear `scripts/commands/auth.sh` — `login` (OAuth2 PKCE), `logout`, `whoami`, `token` | T-19 | 1 | `soma-agent auth login` abre browser, guarda token en `~/.soma/config`. `whoami` muestra email |
| T-21 | Crear `scripts/commands/agent.sh` — `create`, `list`, `show`, `config get/set`, `sandbox create/destroy/mount`, `destroy` | T-13, T-14, T-19 | 2 | `soma-agent agent create --name "X" --engine pi --tools read,bash` → output con agent ID, Linux user, home. `--json` output parseable |
| T-22 | Crear `scripts/commands/engine.sh` — `list`, `info` | T-19 | 0.5 | `soma-agent engine list` → Pi (ready), ReAct (coming soon), etc. `engine info pi` → descripción |
| T-23 | Crear `scripts/commands/skill.sh` — `list`, `show`, `create`, `edit`, `delete`, `assign` | T-19 | 1 | `soma-agent skill create mi-skill` abre $EDITOR. `skill assign mi-skill agent-1` → confirma |
| T-24 | Crear `scripts/commands/workspace.sh` — `list`, `upload`, `download`, `mkdir`, `rm` | T-19 | 1 | `soma-agent workspace upload ./data.csv` → OK. `workspace list` → muestra archivos |
| T-25 | Crear `scripts/commands/conversation.sh` — `list`, `show`, `chat` (WebSocket interactivo) | T-19 | 1.5 | `soma-agent conversation chat agent-1` → terminal chat con streaming |
| T-26 | Crear `scripts/commands/doctor.sh` — `run`, `watch` | T-19 | 0.5 | `soma-agent doctor run` → ejecuta doctor-soma.sh. `doctor watch` → cada 30s |
| T-27 | Implementar `POST/DELETE /api/agents/:id/sandbox` en Elixir | T-08 | 1 | `POST` → useradd + mounts. `DELETE` → userdel -r. 200 con `{uid, home}` |
| T-28 | Implementar `POST/GET/DELETE /api/agents/:id/sandbox/mounts` en Elixir | T-08 | 1 | `POST` → mount --bind. `GET` → lista mounts activos. `DELETE` → umount |
| T-29 | Implementar `GET /api/engines` y `GET /api/engines/:name` en Elixir | T-04 | 0.5 | `GET /api/engines` → `{engines:[{name,status}]}`. Status desde EngineRegistry |

---

## Sprint 4: SDK Portability (Días 16-20)

**Objetivo:** `@zea/soma-sdk` portable — CSS standalone, endpoints configurables, providers.

| ID | Tarea | Dep | Días | Criterio de aceptación |
|----|-------|-----|------|------------------------|
| T-30 | Crear `sdk/src/styles/base.css` — tokens `--glia-*` standalone | — | 1 | CSS con todos los tokens. `import '@zea/soma-sdk/styles/base.css'` renderiza GliaChat sin `zea-design.css` |
| T-31 | Configurar `tsup.config.ts` para copiar CSS a `dist/styles/` | T-30 | 0.5 | `npm run build` → `dist/styles/base.css` existe. `exports` en package.json apunta a `./dist/styles/base.css` |
| T-32 | Agregar `wsPath` a `UseGliaOptions` — WebSocket URL configurable | — | 0.5 | `wsPath: "/custom-ws"` → conecta a `ws://host/custom-ws`. Default: `"/agent-ws"` |
| T-33 | Agregar `apiPrefix` a hooks API — REST URL configurable | — | 0.5 | `apiPrefix: "/api/v2"` → requests a `/api/v2/conversations`. Default: `"/api/v1"` |
| T-34 | Agregar `authHeaders` factory a `UseGliaOptions` y hooks API | — | 1 | `authHeaders: () => ({Authorization: "Bearer x"})` → todas las requests incluyen ese header. Default: `{"x-api-key": apiKey}` |
| T-35 | Agregar `onAuthError` callback a `UseGliaOptions` y hooks API | T-34 | 0.5 | 401/403 → `onAuthError(status)` disparado. App decide redirect o refresh |
| T-36 | Agregar fallback `--glia-*` CSS vars en todos los inline styles de componentes | T-30 | 1 | Cada `var(--zea-bg)` tiene fallback `var(--glia-bg, #0d1117)`. 14 ocurrencias revisadas |
| T-37 | Agregar props `colors` a GliaCopilot, GliaConversationList, GliaFileBrowser, GliaSkillEditor | — | 1 | Cada componente acepta `colors?: Partial<...Colors>`. Override funciona sin ZEA CSS |
| T-38 | Crear `sdk/src/sandbox/types.ts` — `SandboxProvider` interface | — | 0.5 | `listFiles`, `readFile`, `writeFile`, `deleteFile`, `mkdir`. Tipos exportados |
| T-39 | Crear `sdk/src/sandbox/rest-provider.ts` — implementación REST actual | T-38 | 0.5 | `new RestSandboxProvider({baseUrl, apiKey})` → funciona igual que `useGliaFiles` |
| T-40 | Crear `sdk/src/sandbox/memory-provider.ts` — para tests y demos | T-38 | 0.5 | `new MemorySandboxProvider()` → archivos en memoria. `listFiles`/`readFile`/`writeFile` funcionan |
| T-41 | Agregar prop `sandbox` a `GliaFileBrowser` | T-38, T-39 | 0.5 | `sandbox={myProvider}` → usa ese provider. Sin prop → `RestSandboxProvider` (backward compat) |
| T-42 | Agregar prop `agentConfig` a `GliaChat` — bypass identity service | — | 0.5 | `<GliaChat agentId="x" agentConfig={{systemPrompt:"Hola",tools:["read"]}} />` → no contacta Thalamus |
| T-43 | Crear `sdk/README.md` — quick start, API reference, theming, backend requirements | — | 1 | README con 3-paso quick start. Cada componente/hook documentado. Sección de portability |
| T-44 | Agregar `publishConfig` + CI workflow `.github/workflows/sdk-publish.yml` | — | 0.5 | Push a main con tag `sdk-v*` → `npm publish`. `npm pack` produce tarball correcto |

---

## Sprint 5: UI + Landing (Días 21-25)

**Objetivo:** Landing v2 comunica DX + enterprise. Chat UI robusto. E2E tests completos.

| ID | Tarea | Dep | Días | Criterio de aceptación |
|----|-------|-----|------|------------------------|
| T-45 | Reconstruir `ui/src/Landing.tsx` con diseño v2 — Hero + Terminal Preview + How it Works + For Developers + For Companies + Multi-Engine + CTA | — | 2 | Landing renderiza sin errores. Terminal preview muestra `soma-agent agent create`. Secciones colapsan en mobile |
| T-46 | Agregar `ui/src/Landing.tsx` — For Developers section con CLI commands grid + CI/CD code example | T-45 | 0.5 | Grid de 6 comandos. Bloque de código bash de CI/CD. Responsive |
| T-47 | Agregar `ui/src/Landing.tsx` — For Companies section con filesystem hierarchy diagram + enterprise features | T-45 | 0.5 | Diagrama de `/home/soma/` en monoespacio. 6 features cards. "Permission denied" resaltado |
| T-48 | Agregar `ui/src/Landing.tsx` — Multi-Engine section con engine cards (ready/coming-soon) | T-45 | 0.5 | 5 cards: Pi (ready), ReAct (soon), OpenCode (soon), Hermes (soon), Goose (soon). Badges de estado |
| T-49 | Fix `GliaChat.tsx` — thinking colapsable en mensajes persistidos | — | 1 | Mensaje con `msg.thinking` → bloque 🟣 arriba del texto. Toggle expande/colapsa. Thinking sobrevive recarga |
| T-50 | Fix `useGlia.ts` — `contentRef` + `thinkingRef` + binary WS manejo de Blob/ArrayBuffer | — | 1 | `done` handler persiste content + thinking. `console.error` en catch. `binaryType='arraybuffer'`. Logs `[useGlia]` |
| T-51 | Fix `agent-rpc.ts` — `saveSkillAgents` a module scope (evita crash), auto-restart en `start.sh` | — | 0.5 | Watcher de skills no crashea. Process muerto → restart automático en 3s |
| T-52 | Crear `e2e/soma-multiturn.js` — test E2E multi-turno con validación de thinking | T-49, T-50 | 1.5 | Test: landing → login → consent → chat → send 2 prompts → verify both responses + thinking persist → screenshots + browser logs |
| T-53 | Actualizar `doctor-soma.sh` a v2 — 13 capas, 43 checks | T-05, T-27, T-51 | 1 | `./doctor-soma.sh` → 36+ passed, 0 failed. Capas: HTTP, Auth, Multi-Tenancy, Agents, Config, Tools, Sandboxes, API Keys, Conversations, Skills, WebSocket, SDK, E2E |
| T-54 | Actualizar `e2e/soma.spec.js` — smoke test rápido (compatible con doctor fallback) | T-52 | 0.5 | `AGENT RESPONDED` en output. Screenshots en `/tmp/soma-e2e/` |

---

## Sprint 6: Testing & Hardening (Días 26-30)

**Objetivo:** Cobertura de tests completa. Edge cases cubiertos. Documentación final.

| ID | Tarea | Dep | Días | Criterio de aceptación |
|----|-------|-----|------|------------------------|
| T-55 | Escribir unit tests para `lib/soma/skills.ex` — list, get, upsert, delete, assign | — | 1 | `mix test test/soma/skills_test.exs` → verde. Mocks de Thalamus HTTP y filesystem |
| T-56 | Escribir unit tests para `lib/soma/workspace.ex` — upload, delete, history, recover, path traversal | — | 1 | `mix test test/soma/workspace_test.exs` → verde. Path traversal bloqueado. Git commands mockeados |
| T-57 | Escribir unit tests para `lib/soma_web/plugs/jwt_auth.ex` — JWT válido, inválido, JWKS caído | — | 0.5 | Token válido → assigns. Token expirado → no assigns. JWKS unreachable → no crash |
| T-58 | Escribir unit tests para `lib/soma/sandbox.ex` — create, destroy, mounts | T-08 | 0.5 | Mocks de scripts. Parámetros correctos pasados a `useradd`. Rollback en error |
| T-59 | Escribir integration tests — API key create→validate, skill create→list→delete, conversation full lifecycle | — | 1.5 | `mix test test/soma/api_test.exs` → verde. Test DB con migrations. Requests reales a endpoints |
| T-60 | Escribir integration tests — file upload→list→history→recover→delete | — | 1 | Git history tiene commits reales. Recover restaura versión anterior. Delete limpia |
| T-61 | Escribir integration tests — agent sandbox create→exec→destroy (con mocks en CI) | T-08 | 1 | Sandbox.create → mock verifica parámetros. Sandbox.destroy → mock verifica userdel. CI no necesita root |
| T-62 | Escribir E2E tests — cancel mid-stream → cancelled state + partial persistence | T-52 | 1 | `soma-cancel.js`: envía prompt largo, cancela a los 2s, verifica cancelled + contenido parcial |
| T-63 | Escribir E2E tests — multi-agent switch → diferentes agentes en misma UI | T-52, T-42 | 1 | `soma-multi-agent.js`: selecciona agente A → chatea → switch a agente B → chatea. Verifica historiales independientes |
| T-64 | Agregar edge case handling — `useradd` falla (rollback), mount source no existe (skip + warn), nombre duplicado (UUID suffix), home ya existe (reuse/warn) | T-06, T-08 | 1 | Cada edge case tiene test. Scripts no crashean. Logs claros |
| T-65 | Agregar `soma-agent agent create --ttl` — destrucción automática | T-21 | 0.5 | `--ttl 1h` → background job programa `userdel` en 1h. `--ttl 0` → sin TTL |
| T-66 | Agregar `soma-agent conversation chat` — interactive mode con readline + WebSocket | T-25 | 1 | Chat en terminal: prompt → streaming thinking/delta → respuesta. Ctrl+D sale. Colores |
| T-67 | Crear `openspec/soma-agenthub/README.md` — índice de los 3 documentos + cómo usarlos | — | 0.5 | README con links a requirements, design, tasks. Instrucciones para ejecutar tests y doctor |
| T-68 | `mix precommit` — alias que corre formato + credo + tests + doctor | T-53, T-55 | 0.5 | `mix precommit` → exit 0 si todo verde. CI lo ejecuta en cada PR |

---

## Resumen

| Sprint | Días | Tareas | Entregable |
|--------|------|--------|------------|
| 1. Engine + Sandbox | 5 | T-01 → T-10 | Multi-engine funcional, agentes = usuarios Linux |
| 2. Agent Runtime | 5 | T-11 → T-18 | Config completa, WS lifecycle robusto |
| 3. CLI + API | 5 | T-19 → T-29 | `soma-agent` funcional, todos los endpoints |
| 4. SDK Portability | 5 | T-30 → T-44 | SDK portable, CSS standalone, providers |
| 5. UI + Landing | 5 | T-45 → T-54 | Landing v2, thinking persistido, E2E, doctor |
| 6. Testing | 5 | T-55 → T-68 | Unit, integration, E2E, edge cases, CI |
| **Total** | **30** | **68 tareas** | **Soma AgentHub v2 completo** |

---

## Mapeo Requirements → Tareas

| Req | Cubierto por |
|-----|-------------|
| R1 — Multi-Engine | T-01, T-02, T-03, T-04, T-05, T-10 |
| R2 — OS Sandboxes | T-06, T-07, T-08, T-09, T-27, T-28, T-58, T-61, T-64 |
| R3 — CLI | T-19, T-20, T-21, T-22, T-23, T-24, T-25, T-26, T-65, T-66 |
| R4 — Agent Config | T-11, T-12, T-13, T-14 |
| R5 — SDK Portability | T-30, T-31, T-32, T-33, T-34, T-35, T-36, T-37, T-38, T-39, T-40, T-41, T-42, T-43, T-44 |
| R6 — Landing & DX | T-45, T-46, T-47, T-48 |
| R7 — Multi-Tenancy | T-27, T-28, T-29 |
| R8 — Conversations | T-49, T-50, T-51, T-52 |
| R9 — Skills | T-23, T-55 |
| R10 — Testing | T-52, T-53, T-54, T-55, T-56, T-57, T-58, T-59, T-60, T-61, T-62, T-63, T-67, T-68 |
| R11 — Workspace | T-24, T-56, T-60 |
| R12 — WS Lifecycle | T-15, T-16, T-17, T-18 |
| R13 — Auth | T-20, T-34, T-35, T-57 |
