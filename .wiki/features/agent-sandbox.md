# Agent Sandbox — Aislamiento Linux

- **Estado**: ✅ merged
- **Issues**: #f0d4dbc, #406539a, #f4281d3

## Qué se hizo

Aislamiento real de agentes usando usuarios Linux nativos. Cada agente tiene su propio usuario (`soma-{first12chars}`), home directory con `chmod 700`, y ejecución vía `sudo -u`. Skills, workspace y sesiones aisladas por filesystem con permisos UNIX kernel-enforced.

## Decisiones clave

- **Usuarios Linux reales en vez de contenedores**: Más liviano, mismo nivel de aislamiento, sin overhead de Docker-in-Docker
- **`sudo -u` en vez de `spawn({uid, gid})`**: Más portable, no requiere capabilities especiales, funciona en cualquier entorno
- **Home persistente en volumen**: `/home` es un volumen Docker. Los usuarios Linux se recrean en cada arranque vía `start.sh`
- **Scripts dedicados**: `soma-agent-useradd` y `soma-agent-userdel` encapsulan la lógica de creación/destrucción
- **Grupo `soma-agents`**: todos los agentes pertenecen a este grupo para administración

## Flujo

```
WebSocket init
  → agent-rpc.ts: fetchAgentSkills(userId)
  → agent-sandbox.ts: prepareAgent(agentId, skillNames)
      → soma-agent-useradd → usuario Linux + home + workspace
      → copySkills → ~/.agents/skills/
  → RpcBridge: sudo -u soma-{id} pi --mode rpc
```

## Archivos modificados

- `server/agent-sandbox.ts` — `prepareAgent()`, `destroyAgent()`, `copySkills()`
- `server/rpc-bridge.ts` — `sudo -u` + HOME env
- `scripts/soma-agent-useradd` — creación de usuario Linux
- `scripts/soma-agent-userdel` — destrucción de usuario Linux
- `start.sh` — bootstrap de usuarios desde homes persistentes
- `Dockerfile` — shadow, sudo, scripts

## Errores encontrados

- **`spawn()` con uid/gid no funciona en Docker**: el proceso hijo no hereda capabilities → cambiado a `sudo -u`
- **Usuarios se pierden al reiniciar contenedor**: `/etc/passwd` es efímero → `start.sh` recrea desde homes
- **API keys se pierden con `sudo`**: `sudo` limpia el entorno → pasar `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` explícitamente
