# Plan: Aislamiento real de agentes con `sudo -u soma-<id> pi --mode rpc`

## Meta
Cada agente corre como un proceso `pi --mode rpc` independiente, ejecutado como su propio usuario Linux (`soma-<id>`). Skills, workspace y sesiones aisladas por filesystem (permisos UNIX).

## Capas (bottom-up, divide & conquer)

| # | Capa | Qué se hace | Estado |
|---|------|-------------|--------|
| 1 | **Dockerfile + bootstrap** | Instalar `pi` CLI, `sudo`, crear dirs base | ✅ listo |
| 2 | **Script de preparación de agente** | Dado un agentId, crea usuario Linux + copia skills a su home | ✅ listo |
| 3 | **RPC Bridge (core)** | Módulo TypeScript que spawnea `pi --mode rpc`, bridgea JSONL ↔ EventEmitter | ✅ listo |
| 4 | **Refactor agent-rpc.ts** | Reemplazar SDK in-process por RPC Bridge, mantener HTTP API + PostgreSQL | ✅ listo |
| 5 | **Limpiar engines muertos** | Borrar ReAct, Hermes, Goose, OpenCode (stubs). Borrar EngineRegistry | ✅ listo |
| 6 | **Integrar Sandbox Elixir** | Verificar que `Soma.Sandbox` use `soma-agent-useradd` correctamente | ✅ listo |
| 7 | **Skills custom por agente** | Skills se copian al home del agente en init vía agent-sandbox.ts | ✅ listo |
| 8 | **Testing E2E** | 2 agentes, skills distintas, verificar aislamiento real | ✅ listo |

## Reglas
- Cada capa se prueba antes de pasar a la siguiente
- Si una capa no funciona, se corrige ahí sin contaminar las de arriba
- Commits atómicos por capa
