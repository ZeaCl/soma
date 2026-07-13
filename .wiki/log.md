# Log — Soma AgentHub

Bitácora cronológica de cambios. Formato: `## [YYYY-MM-DD] <tipo> | <descripción breve>`

---

## [2026-07-12] docs | .wiki/ — Memoria de equipo para Soma
Creada la estructura `.wiki/` con session-state.md (cómo levantar, servicios, gotchas) y rules.md (patrones: sandbox, RPC bridge, skills, SDK, Docker, API Elixir). Implementación del sistema LLM Wiki de Karpathy para memoria persistente entre sesiones. Issues #26 y #27 del proyecto #18 (Soma x Südlich).

## [2026-07-09] chore | Trigger publish pipeline con nuevo token
Actualizado el token NPM en CI para publicar `@zea.cl/soma-sdk`. El pipeline de GitHub Actions usa `NPM_TOKEN` como secret.

## [2026-07-09] fix | Hardcoded localhost URLs → zea.cl
Cambiadas URLs hardcodeadas de `localhost:4084` a `soma.zea.cl` y `soma.zea.localhost` para consistencia entre entornos. El SDK ahora requiere prop `baseUrl` explícita.

## [2026-07-08] chore | Rename paquete a @zea.cl/soma-sdk
Renombrado de `@zea/soma-sdk` a `@zea.cl/soma-sdk` para alinear con la organización npm `@zea.cl`. Actualizado `package.json`, imports, y CI/CD.

## [2026-07-07] ci | Publish SDK a npm público
Configurado `.github/workflows/publish-npm.yml` para publicar automáticamente el SDK en npm público. Cambiado `publishConfig.access` de `restricted` a `public`.

## [2026-07-06] fix | SDK: persistencia de conversaciones + fallback skills nil
Dos fixes en el SDK React:
- Las conversaciones ahora persisten correctamente en PostgreSQL vía el sidecar
- Si `skillNames` es `null`/`undefined` desde Thalamus, el agente inicia sin skills en vez de crashear

## [2026-07-05] fix | RPC Bridge: sudo -u en vez de uid/gid directo
Cambiada la ejecución del bridge de `spawn` con `{uid, gid}` a `sudo -u <username>`. El enfoque anterior no funcionaba en todos los entornos porque `spawn` con uid/gid requiere capacidades especiales. `sudo -u` es más portable y kernel-enforced. 3 bugs resueltos.

## [2026-07-04] fix | Aislamiento real de skills + persistencia de usuarios Linux
Dos cambios mayores en el sandbox:
- Skills ahora se copian por agente a `~/.agents/skills/`, no se comparten desde un directorio global. Cada agente solo ve sus skills asignadas.
- `start.sh` ahora recrea usuarios Linux desde homes persistentes en el volumen `/home`. Resuelve el problema de que los usuarios se perdían al reiniciar el contenedor.

## [2026-07-03] feat | SDK: useGliaFileContent, GliaFileViewer, createAgent, JWT Bearer
Nuevos features en el SDK:
- `useGliaFileContent` — leer contenido de archivos del workspace
- `GliaFileViewer` — componente para previsualizar archivos
- `createAgent` en `useGliaAgents` — crear agentes desde el frontend
- Auth: soporte para JWT Bearer token (además de API key)

## [2026-07-02] test | Verificación de aislamiento de skills entre agentes
Tests automatizados que verifican que dos agentes diferentes no pueden ver las skills del otro. Confirmado: permisos UNIX 700 en home + copia selectiva de skills = aislamiento real.

## [2026-07-01] feat | Aislamiento real con pi --mode rpc por usuario Linux
Refactor completo del sandbox. Cada agente ahora corre como su propio usuario Linux con `pi --mode rpc`. Workspace, sesiones y skills aislados por filesystem. Scripts `soma-agent-useradd` y `soma-agent-userdel`.

## [2026-06-30] feat | SomaPanel, SkillManager, sandbox per-agent
Nuevos componentes SDK: `SomaPanel` (navegación files/skills), `SkillManager` (CRUD de skills). Sandbox ahora es per-agent con skills isolation. Fix en REST provider para `HeadersInit` type.

## [2026-06-28] docs | README con SDK DX
README.md actualizado con quick start del SDK, componentes, hooks, themes, y ejemplos de integración. Documentación para desarrolladores que integran Soma en sus apps.

## [2026-06-27] feat | Landing dual: zea.cl + soma.zea.cl
Soma ahora sirve dos landings: `/` para la plataforma ZEA general y `/soma` para AgentHub específico. Componentes `ZeaLanding` y `DevsLanding` en el mismo contenedor.

## [2026-06-26] feat | Agent sharing + deploy AMD64
Modelo de agent shares: agentes pueden compartirse entre usuarios de la misma organización. Deploy fix: build AMD64 en servidor de producción. Tabla `agent_shares` en PostgreSQL.

## [2026-06-25] fix | API key creation fallback + production cleanup
Fix: creación de API keys con fallback a organización default (`00000000-...`). Limpieza de código legacy y URLs hardcodeadas de staging.

---

## [2026-06-24] feat | Versión inicial de Soma AgentHub
Primera versión funcional con:
- Elixir API (Phoenix Plug.Router) con CRUD de conversaciones, archivos, skills
- Pi Sidecar (Node.js) con WebSocket agentes y RPC bridge
- SDK React (`@zea/soma-sdk`) con GliaChat, hooks, temas
- CLI (`soma`) para gestión de agentes y archivos
- Docker multi-stage con Alpine Linux
- Sandbox con usuarios Linux reales
