# Wiki Index — Soma AgentHub

## 🚀 Para empezar una sesión nueva

- **[Estado de sesión](session-state.md)** ← **Leer esto primero**. Arquitectura, servicios, cómo levantar, credenciales, gotchas, stack, SDK.

---

## Features

> Una página por feature completada. Formato: qué se hizo, decisiones clave, archivos modificados, errores encontrados.

- [agent-sandbox](features/agent-sandbox.md) — Aislamiento de agentes con usuarios Linux reales (soma-agent-useradd/del)
- [user-workspace](features/user-workspace.md) — Sandboxes de usuarios humanos (user-useradd/del, UserWorkspace SDK)
- [sdk-react](features/sdk-react.md) — @zea.cl/soma-sdk: componentes, hooks, temas, publish npm
- [rpc-bridge](features/rpc-bridge.md) — Puente stdin/stdout JSONL con pi --mode rpc
- [skills-isolation](features/skills-isolation.md) — Copia y aislamiento de skills por agente
- [agent-sharing](features/agent-sharing.md) — Compartir agentes entre usuarios de una organización

---

## Integraciones

> Una página por servicio externo que Soma consume.

- [thalamus](integrations/thalamus.md) — Auth OAuth2/JWT, agent config, JWKS, domain roles
- [cranium](integrations/cranium.md) — Pieces API, sidebar sections, render modes
- [postgresql](integrations/postgresql.md) — Schema, migraciones, tablas, pool

---

## Reglas

- **[rules](rules.md)** — Convenciones y patrones descubiertos: sandbox, RPC bridge, skills, SDK, Docker, API
- **[test-matrix](test-matrix.md)** — Matriz de pruebas: 40 casos, 6 categorías, criterios de aceptación

---

## Log

- **[log.md](log.md)** — Bitácora cronológica de cambios (desde 2026-06-24)
