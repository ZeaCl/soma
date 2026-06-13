# Soma AgentHub — Test Matrix (v3)

> 14 capas, 80+ casos. Cada uno mapeado a método de validación y estado.

```
🔬  Métodos
───────────
  D  = Doctor (doctor-soma.sh)         E  = E2E Playwright
  W  = WebSocket directo (Python)       U  = Unit test (mix test)
  A  = API curl                         M  = Manual (no automatizado)
  K  = CLI (soma-agent)                 S  = Script (bash)
```

---

## Capa 1 — HTTP & Infra

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| H1 | Soma HTTP health (200) | D | ✅ |
| H2 | Thalamus JWKS available | D | ✅ |
| H3 | Caddy proxy → Soma | D | ✅ |
| H4 | Agent RPC (Pi sidecar) responds | D | ✅ |
| H5 | Docker container healthy | D | ✅ |
| H6 | Agent RPC process alive | D | ✅ |
| H7 | Agent RPC auto-restart on crash | D | ⚠️ Agregar |

## Capa 2 — Auth

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| A1 | Agent token from Thalamus | D | ✅ |
| A2 | JWT validation (JWKS) | D | ✅ |
| A3 | PAT token | D | ✅ |
| A4 | API key creation (zs_live_...) | D | ✅ |
| A5 | API key invalid → 401 | D | ✅ |
| A6 | JWT auth (Bearer) → OK | E | ✅ |
| A7 | Scoped API key enforced | A | ❌ Fase 2 |

## Capa 3 — Multi-Tenancy

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| T1 | Org A files ≠ Org B files | A | ⚠️ Agregar |
| T2 | Org A skills ≠ Org B skills | D | ✅ |
| T3 | API key vinculada a org | D | ✅ |
| T4 | Conversaciones aisladas por org | A | ⚠️ Agregar |
| T5 | Agentes ven solo su org | A | ❌ Fase 5 |

## Capa 4 — Agents = Users

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| G1 | GET /api/agents lista | A | ⚠️ |
| G2 | Agente tiene agent_config | A | ⚠️ |
| G3 | Usuario no-agente no aparece | A | ❌ |
| G4 | Agente pertenece a org | A | ⚠️ |
| G5 | Agente = usuario Linux (`useradd`) | S | ❌ Fase 7 |
| G6 | Agente tiene grupo org | S | ❌ Fase 7 |

## Capa 5 — Agent Config Injection

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| C1 | System prompt inyectado en sesión | W | ⚠️ |
| C2 | Skills inyectadas en sesión | W | ⚠️ |
| C3 | Cambio de config en caliente | W | ❌ |
| C4 | Config local fallback | M | ⚠️ |
| C5 | Workspace paths inyectados | W | ❌ |
| C6 | Tools configurables por agente | W | ❌ P0 |
| C7 | Engine inyectado (pi/react/opencode) | W | ❌ Fase 6 |
| C8 | Mounts inyectados (bind mounts) | S | ❌ Fase 7 |

## Capa 6 — Tools

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| L1 | Tools default (read,bash,edit,write) | W | ✅ |
| L2 | Tools configurables por agente | W | ❌ P0 |
| L3 | Tool bash scoped al home del agente | S | ❌ Fase 7 |
| L4 | Tool read bloqueada en home de otro agente | S | ❌ Fase 7 |

## Capa 7 — OS Sandboxes (Agentes = Usuarios Linux)

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| S1 | Agente tiene usuario Linux (`soma-{id}`) | S | ❌ Fase 7 |
| S2 | Home del agente: `/home/soma/{id}` | S | ❌ Fase 7 |
| S3 | chmod 700 — otro agente no puede leer | S | ❌ Fase 7 |
| S4 | Bind mount de directorio compartido | S | ❌ Fase 7 |
| S5 | Bind mount read-only (datos externos) | S | ❌ Fase 7 |
| S6 | sudo -u agente ejecuta comando | S | ❌ Fase 7 |
| S7 | Grupos Linux = equipos/orgs | S | ❌ Fase 7 |
| S8 | userdel -r destruye sandbox | S | ❌ Fase 7 |
| S9 | Agente efímero (preview) → home temporal | S | ❌ Fase 7 |

## Capa 8 — Multi-Engine

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| E1 | Engine Registry registra Pi | U | ❌ Fase 6 |
| E2 | Engine Registry registra ReAct | U | ❌ Fase 6 |
| E3 | Engine Registry registra OpenCode | U | ❌ Fase 6 |
| E4 | Agente con engine=pi → PiEngine | W | ❌ Fase 6 |
| E5 | Agente con engine=react → ReActEngine | W | ❌ Fase 6 |
| E6 | Agente sin engine → default pi | W | ❌ Fase 6 |
| E7 | Engine desconocido → error | W | ❌ Fase 6 |
| E8 | 2 agentes simultáneos con distinto engine | W | ❌ Fase 6 |

## Capa 9 — Sandbox REST API

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| F1 | GET /api/files lista archivos | D | ✅ |
| F2 | POST /api/files/upload | D | ✅ |
| F3 | Git history | D | ✅ |
| F4 | Git recover | A | ❌ |
| F5 | AGENTS.md context | M | ⚠️ |
| F6 | Path traversal bloqueado | U | ⚠️ |
| F7 | POST /api/agents/:id/sandbox → useradd | A | ❌ Fase 7 |
| F8 | DELETE /api/agents/:id/sandbox → userdel -r | A | ❌ Fase 7 |

## Capa 10 — API Keys

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| K1 | Crear API Key | D | ✅ |
| K2 | Key hash guardado (nunca raw) | D | ✅ |
| K3 | Key inválida → 401 | D | ✅ |
| K4 | Key sin scope suficiente → 403 | A | ❌ |

## Capa 11 — Conversations & Messages

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| M1 | Conversación creada en DB | D | ✅ |
| M2 | Mensajes persistidos | D | ✅ |
| M3 | Thinking persistido | D | ✅ |
| M4 | Multi-turn (4 mensajes) | E | ✅ |
| M5 | Soft delete conversación | A | ❌ |

## Capa 12 — Skills

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| SK1 | GET /api/skills lista | D | ✅ |
| SK2 | Skills builtin del filesystem | D | ✅ |
| SK3 | Crear skill custom | D | ✅ |
| SK4 | Skill custom sobreescribe builtin | A | ⚠️ |
| SK5 | Auto-discovery skills nuevas | M | ⚠️ |
| SK6 | Asignar skill a agentes | A | ❌ |

## Capa 13 — CLI (soma-agent)

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| CLI1 | `soma agent create` → useradd + config | K | ❌ |
| CLI2 | `soma agent list` → lista agentes | K | ❌ |
| CLI3 | `soma agent config set systemPrompt` | K | ❌ |
| CLI4 | `soma agent config set engine` | K | ❌ |
| CLI5 | `soma agent config set tools` | K | ❌ |
| CLI6 | `soma agent sandbox mount add` | K | ❌ |
| CLI7 | `soma agent sandbox mount list` | K | ❌ |
| CLI8 | `soma agent destroy` → userdel -r | K | ❌ |
| CLI9 | `soma skill create` | K | ❌ |
| CLI10 | `soma skill assign` | K | ❌ |
| CLI11 | `soma workspace upload` | K | ❌ |
| CLI12 | `soma doctor` → ejecuta doctor-soma.sh | K | ❌ |

## Capa 14 — WebSocket Session

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| W1 | Flujo init→ready→prompt→delta→done | D | ✅ |
| W2 | Cancel durante streaming | D | ✅ |
| W3 | Reconexión reanuda sesión | W | ❌ |
| W4 | Múltiples sesiones simultáneas | W | ⚠️ |
| W5 | done incluye content + thinking | D | ✅ |
| W6 | Mismo engine, distinto agentId | W | ❌ Fase 6 |
| W7 | Distinto engine, mismo protocolo | W | ❌ Fase 6 |

---

## Capa 15 — E2E Browser

| ID | Caso | Método | Estado |
|----|------|--------|--------|
| U1 | Login OAuth2 flow completo | E | ✅ |
| U2 | Chat envía y recibe respuesta | E | ✅ |
| U3 | Thinking visible en UI | E | ✅ |
| U4 | Multi-turn (2 intercambios) | E | ✅ |
| U5 | Respuesta persiste (no desaparece) | E | ✅ |
| U6 | Thinking toggle expand/colapsa | E | ✅ |
| U7 | Landing explica DX + empresa | E | ❌ |
| U8 | Sidebar navigation | E | ❌ |
| U9 | Cambiar de agente (switch) | E | ❌ |
| U10 | Cancel streaming | E | ❌ |
| U11 | Agente con distinto engine | E | ❌ Fase 6 |

---

## Resumen por fase

```
Fase                            Casos   ✅   ⚠️   ❌
──────────────────────────────── ─────  ───  ───  ───
Hoy (implementado)                36    24    7    5
Fase 1 — CSS Standalone            0     -    -    -
Fase 2 — Endpoints                 2     -    -    2
Fase 3 — Publicación               0     -    -    -
Fase 4 — Sandbox Abstraction       0     -    -    -
Fase 5 — Identity                  2     -    -    2
Fase 6 — Multi-Engine             10     -    1    9
Fase 7 — OS Sandboxes             15     -    -   15
CLI                               12     -    -   12
──────────────────────────────── ─────  ───  ───  ───
Total                             77    24    8   45
```

---

## Priorización

```
🔴 P0 (bloqueantes)
  C6  — Tools configurables por agente
  L2  — Tools configurables por agente (server)
  E4  — Engine inyectado desde config
  CLI1— soma agent create funcional

🟡 P1 (core)
  Fase 7 completa — OS Sandboxes
  Fase 6 completa — Multi-Engine registry
  C8  — Mounts inyectados
  CLI2-CLI8 — CLI gestión de agentes

🟢 P2 (calidad de vida)
  Fase 1-5 SDK
  CLI9-CLI12 — CLI skills/workspace/doctor
  U7 — Landing actualizada
```
