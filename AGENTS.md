# AGENTS.md — Soma AgentHub

Multi-agent chat, skills, workspaces & sandboxed execution. Elixir API + Node.js Pi Sidecar + React SDK.

---

## Workflow de desarrollo

### Features pequeñas / fixes

1. Crear issue en GitHub via CLI
2. Rama `feature/<nombre>` o `fix/<nombre>`
3. Implementar
4. Tests: `mix test` (Elixir), `npm run build` (SDK)
5. PR → code review → squash merge

### Features grandes

Para funcionalidades complejas (múltiples archivos, integración con servicios, cambios de arquitectura):

1. **Especificar en `.wiki/features/<feature>.md`** antes de codificar:
   - Qué se va a hacer
   - Decisiones clave anticipadas
   - Archivos que se van a tocar
2. **Crear issue padre** con el plan
3. **Crear sub-issues** (`gh issue create --repo ZeaCl/soma`) para cada paso
4. Agregar al **GitHub Project** #18
5. Implementar paso a paso

### Herramientas disponibles

| Herramienta | Uso |
|---|---|
| `gh issue create --repo ZeaCl/soma` | Crear issues |
| `gh issue close N` | Cerrar issues |
| `gh pr create / review / merge` | Pull requests |
| `gh project item-add 18 --owner ZeaCl` | Agregar al project board |
| **GitHub Project** | https://github.com/orgs/ZeaCl/projects/18 |
| `mix test` | Tests Elixir |
| `mix format --check-formatted` | Formateo Elixir |
| `npm run build` (en `sdk/`) | Build del SDK React |
| `docker build -t soma .` | Build del contenedor |

---

## Cómo levantar localmente

### Docker (recomendado)

```bash
# Build
docker build -t soma .

# Run (necesita PostgreSQL)
docker run -d \
  -p 4084:4084 -p 3002:3002 \
  -e DATABASE_URL="ecto://postgres:postgres@host.docker.internal:5432/soma_prod" \
  -e SECRET_KEY_BASE="dev-secret-64-bytes-minimum" \
  -e THALAMUS_URL="http://thalamus:4000" \
  -v soma-homes:/home \
  --name soma \
  soma

# Health check
curl http://localhost:4084/health
```

### Solo Elixir API (sin sandbox)

```bash
mix deps.get
mix ecto.create && mix ecto.migrate
mix phx.server   # :4084
```

⚠️ El Pi Sidecar (WebSocket agentes) no funciona sin Docker — necesita `sudo`, `useradd`, `pi` CLI.

### SDK

```bash
cd sdk
npm install
npm run build   # tsup → dist/
npm link        # para desarrollo local
```

---

## Docker (ecosistema ZEA)

```bash
cd ../zea
# Build + deploy
docker compose -f docker-compose.local.yml up -d --build soma
# Solo levantar
docker compose -f docker-compose.local.yml up -d soma
# → http://soma.zea.localhost
```

---

## Convenciones

### Commits

- `feat:` — nueva funcionalidad
- `fix:` — bug fix
- `docs:` — documentación
- `refactor:` — refactor sin cambiar comportamiento
- `test:` — tests
- `ci:` — CI/CD
- `chore:` — tareas de mantenimiento

Incluir `Closes #N` si cierra un issue.

### Branches

- `feature/<nombre>` — features nuevas
- `fix/<nombre>` — bug fixes
- `main` — producción (solo merge vía PR)

### Elixir

- `mix format` antes de commitear
- `mix test` debe pasar
- Usar `Plug.Router`, no Phoenix completo
- Autenticación en plugs: `jwt_auth.ex` + `api_key_auth.ex`

### TypeScript (Sidecar + SDK)

- Sidecar: Node.js con `tsx` para ejecución
- SDK: tsup para build (CJS + ESM + tipos)
- Sin dependencias de UI externas en el SDK

### Docker

- `Dockerfile` multi-stage: deps → build → runtime
- `start.sh` como entrypoint con auto-restart
- Health check: `wget --spider -q http://localhost:4084/health`
- Scripts de sandbox en `/usr/local/bin/`

---

## Stack

| Capa | Tecnología |
|---|---|
| API | Elixir 1.18, Phoenix (Plug.Router), Ecto, PostgreSQL |
| Sidecar | Node.js, TypeScript, `ws` (WebSocket), `pg` |
| Sandbox | Linux users (shadow/sudo), pi CLI |
| SDK | React 18/19, TypeScript, tsup |
| CLI | Node.js |
| Infra | Docker multi-stage, Alpine Linux 3.21 |

---

## No hacer

- ❌ No usar `mix phx.server` para producción — siempre `mix release`
- ❌ No hardcodear URLs en el SDK (usa prop `baseUrl`)
- ❌ No crear usuarios Linux con `useradd` directo — usar los scripts `soma-*-useradd`
- ❌ No asumir que Thalamus siempre responde — fallback a array vacío
- ❌ No modificar el SDK sin rebuild + publish
- ❌ No pushear a `main` directamente — siempre vía PR
- ❌ No exponer el Pi Sidecar sin autenticación

---

## Memoria persistente (`.wiki/`)

El equipo mantiene un wiki de conocimiento del proyecto en `.wiki/`. Es la **memoria entre sesiones** — permite saber qué se hizo, cómo funciona, y qué patrones se descubrieron sin tener que re-explorar cada vez.

### Estructura

```
.wiki/
  index.md              ← catálogo de todas las páginas
  log.md                ← bitácora cronológica (qué se hizo y cuándo)
  rules.md              ← convenciones y patrones descubiertos
  session-state.md      ← contexto completo para arrancar sesión nueva
  features/
    <feature>.md        ← una página por feature (estado, decisiones, gotchas)
  integrations/
    <servicio>.md       ← una página por servicio externo (endpoints, auth, quirks)
```

### Cuándo escribir

| Momento | Acción |
|---|---|
| Al **terminar una feature** (merge a main) | Crear/actualizar `.wiki/features/<feature>.md` |
| Al **descubrir un patrón o regla** | Agregar a `.wiki/rules.md` y actualizar este AGENTS.md |
| Al **integrar con un servicio externo** | Crear/actualizar `.wiki/integrations/<servicio>.md` |
| **Siempre**, después de cualquier cambio | Agregar entrada a `.wiki/log.md` |
| **Siempre** | Mantener `.wiki/index.md` actualizado |

### Cuándo leer

| Momento | Qué leer |
|---|---|
| Al **iniciar una sesión nueva** | `.wiki/session-state.md` + `.wiki/log.md` |
| Antes de **tocar una integración** | `.wiki/integrations/<servicio>.md` |
| Antes de **empezar una feature** | `.wiki/features/<feature>.md` + `.wiki/rules.md` |
| Al **encontrar un error** | `.wiki/log.md` + `.wiki/features/` relacionadas |

### Formato

```markdown
# <Feature Name>

- **Estado**: ✅ merged / 🔄 en progreso / ⬜ planeado
- **Issue**: #N

## Qué se hizo
[2-3 bullets]

## Decisiones clave
- [decisión]

## Archivos modificados
- `path/to/file`

## Errores encontrados
- [error] → [solución]
```

---

## Documentos clave

| Documento | Path |
|---|---|
| README.md | `./README.md` |
| Integration Guide | `./INTEGRATION_GUIDE.md` |
| Plan de Aislamiento | `./PLAN-ISOLATION.md` |
| Session State | `.wiki/session-state.md` |
| Rules & Patterns | `.wiki/rules.md` |
| Docs (público) | `docs/index.md` |
| Skills (agentes IA) | `skill/SKILL.md` |
