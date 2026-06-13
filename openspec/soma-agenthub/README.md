# Soma AgentHub — OpenSpec

Especificación técnica completa del AgentHub multi-engine de ZEA Platform.

## Documentos

| Fase | Archivo | Contenido |
|------|---------|-----------|
| 1 — Requirements | [01-requirements.md](./01-requirements.md) | 13 reqs · 88 criterios EARS · 14 edge cases |
| 2 — Design | [02-design.md](./02-design.md) | Arquitectura · DB schema · 30+ endpoints · Engine interface |
| 3 — Tasks | [03-tasks.md](./03-tasks.md) | 6 sprints · 68 tareas · 30 días · 100% cobertura |

## Cómo usar esta especificación

```bash
# 1. Leer requirements (QUÉ hace el sistema)
cat 01-requirements.md

# 2. Leer design (CÓMO se construye)
cat 02-design.md

# 3. Implementar en orden (tasks)
cat 03-tasks.md

# 4. Validar con el doctor después de cada sprint
cd /Users/dev/Documents/zea/soma && ./doctor-soma.sh

# 5. Correr tests E2E
cd e2e && node soma-multiturn.js
```

## Estado actual

```
Sprint 1 — Engine + Sandbox      ✅  T-01→T-10   Multi-engine, agentes=usuarios Linux
Sprint 2 — Agent Runtime         ✅  T-11→T-18   Config inyectable, WS lifecycle
Sprint 3 — CLI + API             ✅  T-19→T-29   soma-agent, endpoints
Sprint 4 — SDK Portability       ✅  T-30→T-44   CSS standalone, wsPath, providers
Sprint 5 — UI + Landing          ✅  T-45→T-54   Landing v2, thinking, E2E, doctor
Sprint 6 — Testing               ⏳  T-55→T-68   Unit, integration, E2E
```

## Verificación rápida

```bash
# Doctor (13 capas)
./doctor-soma.sh

# E2E multi-turn (Playwright)
cd e2e && node soma-multiturn.js

# CLI manual test
SOMA_API_KEY=zs_live_xxx ./scripts/soma-agent engine list
```

## Arquitectura

```
Browser/CLI → Caddy → Soma Elixir :4084 (REST + SPA)
                    → Agent RPC :3002 (WebSocket + Engine Registry)
                         ├── PiEngine (@earendil-works/pi)
                         ├── ReActEngine (stub)
                         ├── OpenCodeEngine (stub)
                         ├── HermesEngine (stub)
                         └── GooseEngine (stub)
                              ↓
                         Linux Kernel (useradd, chmod 700, bind mounts)
```
