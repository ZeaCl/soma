# Soma AgentHub — Test Matrix

> Matriz completa de validación: qué se prueba, cómo, dónde y estado.

```
🔬  Métodos de validación
──────────────────────────
  D  = Doctor (doctor-soma.sh)         E  = E2E Playwright
  W  = WebSocket directo (Python)       U  = Unit test (mix test)
  A  = API curl                         M  = Manual (no automatizado)
```

---

## Capa 1: HTTP & Infra

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| H1 | Soma HTTP health (200) | D | `doctor-soma.sh` [1] | ✅ |
| H2 | Thalamus JWKS available | D | `doctor-soma.sh` [1] | ✅ |
| H3 | Caddy proxy → Soma | D | `doctor-soma.sh` [1] | ✅ |
| H4 | Agent RPC (Pi sidecar) responds | D | `doctor-soma.sh` [4] | ✅ |
| H5 | Docker container healthy | D | `doctor-soma.sh` | ⚠️ Agregar |
| H6 | Node.js agent-rpc process alive | D | `doctor-soma.sh` | ⚠️ Agregar |

## Capa 2: Auth

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| A1 | Agent token from Thalamus | D | `doctor-soma.sh` [2] | ✅ |
| A2 | JWT validation (JWKS) | D | `doctor-soma.sh` [2] | ✅ |
| A3 | PAT token (th_pat_live_...) | D | `doctor-soma.sh` [2] | ✅ |
| A4 | API key creation (zs_live_...) | A | `e2e/soma-multiturn.js` | ⚠️ Agregar |
| A5 | API key invalid → 401 | E | `e2e/` | ❌ Falta |
| A6 | JWT auth (Bearer) → OK | E | `e2e/` | ✅ Implícito en flow |
| A7 | Scoped API key enforced | A | `e2e/` | ❌ Falta |

## Capa 3: Multi-Tenancy

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| T1 | Org A files ≠ Org B files | E | `e2e/` | ❌ Falta |
| T2 | Org A skills ≠ Org B skills | A | `doctor-soma.sh` | ⚠️ Agregar |
| T3 | API key vinculada a org | A | `doctor-soma.sh` | ⚠️ Agregar |
| T4 | Conversaciones aisladas por org | A | `doctor-soma.sh` | ⚠️ Agregar |

## Capa 4: Agents = Users

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| G1 | GET /api/agents lista agentes | A | `doctor-soma.sh` | ⚠️ Agregar |
| G2 | Agente tiene agent_config | A | `doctor-soma.sh` | ⚠️ Agregar |
| G3 | Usuario no-agente no aparece | A | `doctor-soma.sh` | ❌ Falta |
| G4 | Agente pertenece a org | A | `doctor-soma.sh` | ⚠️ Agregar |

## Capa 5: Agent Config Injection

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| C1 | System prompt inyectado en sesión | W | `doctor-soma.sh` | ⚠️ Agregar |
| C2 | Skills inyectadas en sesión | W | `doctor-soma.sh` | ⚠️ Agregar |
| C3 | Cambio de config en caliente | W | `doctor-soma.sh` | ❌ Falta |
| C4 | Config local fallback (Thalamus caído) | M | — | ⚠️ Manual |
| C5 | Workspace paths inyectados | W | `doctor-soma.sh` | ❌ Falta |
| C6 | Tools configurables por agente | W | `doctor-soma.sh` | ❌ P0 |

## Capa 6: Tools

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| L1 | Tools default (read,bash,edit,write) | W | `doctor-soma.sh` | ✅ Implícito |
| L2 | Tools configurables por agente | W | `doctor-soma.sh` | ❌ P0 — hardcodeado |
| L3 | Tool bash scoped al workspace | M | — | ❌ No implementado |

## Capa 7: Sandboxes

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| S1 | GET /api/files lista archivos | D | `doctor-soma.sh` [3] | ✅ |
| S2 | POST /api/files/upload crea archivo | A | `e2e/` | ❌ Falta |
| S3 | Git history (commits) | A | `e2e/` | ❌ Falta |
| S4 | Git recover (checkout) | A | `e2e/` | ❌ Falta |
| S5 | AGENTS.md context loaded | M | — | ⚠️ Manual |
| S6 | Path traversal bloqueado | U | `test/` | ⚠️ Parcial |

## Capa 8: API Keys

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| K1 | Crear API Key | A | `doctor-soma.sh` | ⚠️ Agregar |
| K2 | Key hash guardado (nunca raw) | D | `doctor-soma.sh` | ⚠️ Agregar |
| K3 | Key inválida → 401 | A | `doctor-soma.sh` | ⚠️ Agregar |
| K4 | Key sin scope suficiente → 403 | A | `e2e/` | ❌ Falta |

## Capa 9: Conversations & Messages

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| M1 | Conversación creada en DB | D | `doctor-soma.sh` [5] | ✅ |
| M2 | Mensajes persistidos (user + assistant) | D | `doctor-soma.sh` [5] | ✅ |
| M3 | Thinking persistido en mensaje | D | `doctor-soma.sh` | ⚠️ Agregar |
| M4 | Multi-turn (4 mensajes) | E | `e2e/soma-multiturn.js` | ✅ |
| M5 | Soft delete conversación | A | `e2e/` | ❌ Falta |

## Capa 10: Skills

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| K1 | GET /api/skills lista skills | D | `doctor-soma.sh` [3] | ✅ |
| K2 | Skills builtin del filesystem | D | `doctor-soma.sh` [6] | ✅ |
| K3 | Crear skill custom | A | `e2e/` | ❌ Falta |
| K4 | Skill custom sobreescribe builtin | A | `e2e/` | ❌ Falta |
| K5 | Auto-discovery de skills nuevas | M | — | ⚠️ Manual |
| K6 | Asignar skill a agentes | A | `e2e/` | ❌ Falta |

## Capa 11: WebSocket Session

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| W1 | Flujo init→ready→prompt→delta→done | D | `doctor-soma.sh` [7] | ✅ |
| W2 | Cancel durante streaming | W | `doctor-soma.sh` | ⚠️ Agregar |
| W3 | Reconexión reanuda sesión | W | `doctor-soma.sh` | ❌ Falta |
| W4 | Múltiples sesiones simultáneas | W | `doctor-soma.sh` | ❌ Falta |
| W5 | done incluye content + thinking | W | `doctor-soma.sh` | ⚠️ Agregar |

## Capa 12: UI / E2E Browser

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| U1 | Login OAuth2 flow completo | E | `e2e/soma-multiturn.js` | ✅ |
| U2 | Chat envía y recibe respuesta | E | `e2e/soma-multiturn.js` | ✅ |
| U3 | Thinking visible en UI | E | `e2e/soma-multiturn.js` | ✅ |
| U4 | Multi-turn (2 intercambios) | E | `e2e/soma-multiturn.js` | ✅ |
| U5 | Respuesta persiste (no desaparece) | E | `e2e/soma-multiturn.js` | ✅ |
| U6 | Thinking toggle expand/colapsa | E | `e2e/soma-multiturn.js` | ✅ |
| U7 | Sidebar navigation | E | `e2e/` | ❌ Falta |
| U8 | Skills panel UI | E | `e2e/` | ❌ Falta |
| U9 | Files panel UI | E | `e2e/` | ❌ Falta |
| U10 | Logout flow | E | `e2e/soma-multiturn.js` | ⚠️ Parcial |
| U11 | Cancel streaming | E | `e2e/` | ❌ Falta |
| U12 | Diferentes agentes (switch) | E | `e2e/` | ❌ Falta |

## Capa 13: SDK Portability

| ID | Caso | Método | Archivo | Estado |
|----|------|--------|---------|--------|
| P1 | SDK compila standalone | U | `sdk/dist/` | ✅ |
| P2 | CSS sin var(--zea-*) | M | `sdk/styles/` | ❌ Fase 1 |
| P3 | wsPath configurable | U | `sdk/src/` | ❌ Fase 2 |
| P4 | authHeaders factory | U | `sdk/src/` | ❌ Fase 2 |
| P5 | SandboxProvider interface | U | `sdk/src/` | ❌ Fase 4 |
| P6 | AgentProvider interface | U | `sdk/src/` | ❌ Fase 5 |

---

## Resumen

```
Total casos: 58
✅ Implementado y testeado:  19
⚠️ Implementado sin test:    16
❌ No implementado:           23
─────────────────────────────────
🔴 P0 (críticos):             2  (C6: tools configurables, L1: bash scoped)
🟡 P1 (importantes):          8
🟢 P2 (nice-to-have):        13
```

## Plan de ataque (orden)

```
1. Doctor-soma.sh → cubrir los 16 ⚠️
2. E2E tests → cubrir U7-U12 + K3-K6 + S2-S4 + M5
3. P0 fix: tools configurables (C6, L2)
4. SDK Fase 1: CSS standalone (P2)
5. SDK Fase 2: wsPath + authHeaders (P3, P4)
6. Validar todo con el doctor actualizado
```
