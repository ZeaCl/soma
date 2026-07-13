# Skills Isolation

- **Estado**: ✅ merged
- **Issues**: #f0d4dbc, #c70491c, #c5f6814

## Qué se hizo

Sistema de aislamiento de skills por agente. Cada agente solo tiene acceso a las skills que Thalamus le asigna vía `agent_config`. Las skills se copian al home del agente y `pi` las lee desde `~/.agents/skills/`. Verificado con tests que dos agentes no pueden ver las skills del otro.

## Decisiones clave

- **Copia, no symlink**: las skills se copian físicamente a cada home. Más seguro, sin riesgo de path traversal
- **Dos fuentes de skills**: built-in (`/root/.agents/skills/`) y custom (`/app/.pi-agent-skills/`)
- **Filtrado por Thalamus**: `agent_config.skillNames` define qué skills se copian
- **Test de aislamiento**: `test-skill-isolation.ts` verifica que agentes diferentes no comparten skills

## Flujo

```
1. Thalamus: GET /api/agents/{uid}/config → { skillNames: [...], systemPrompt: "..." }
2. agent-sandbox.ts: copySkills(home, skillNames)
3. Itera skillNames, busca en /root/.agents/skills/ y /app/.pi-agent-skills/
4. Copia cada skill encontrada a {home}/.agents/skills/
5. pi --mode rpc → lee ~/.agents/skills/ → solo ve las suyas
```

## Archivos modificados

- `server/agent-sandbox.ts` — `copySkills(home, skillNames)`, `copyAgentAuth()`
- `server/agent-rpc.ts` — `fetchAgentSkills(userId)` → Thalamus
- `server/test-skill-isolation.ts` — tests de aislamiento
- `start.sh` — bootstrap de `/root/.agents/skills/`
- `Dockerfile` — directorio `/app/.pi-agent-skills/`

## Errores encontrados

- **skillNames = nil → crash**: Thalamus puede devolver `null` si el agente no tiene config → fallback a `[]`
- **Skills no encontradas en el source**: si una skill del listado no existe en disco, se saltea con warning (no crashea)
- **pi CLI lee skills del directorio equivocado**: verificar que `HOME` está bien seteado y `~/.agents/skills/` existe
