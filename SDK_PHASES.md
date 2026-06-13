# SDK Portability — Implementation Tasks

> Checklist detallada para hacer el `@zea/soma-sdk` completamente portable.
> Cada tarea tiene archivo, cambios esperados, y criterio de aceptación.

---

## Fase 1 — CSS Standalone

**Objetivo:** El SDK funcione visualmente sin `zea-design.css` ni `var(--zea-*)`.

### 1.1 — Crear `glia-base.css`

**Archivo:** `sdk/src/styles/base.css`

```css
/* Tokens standalone — sin dependencia ZEA */
.glia-root {
  --glia-bg: #0d1117;
  --glia-text: #e6edf3;
  --glia-text-muted: #8b949e;
  --glia-user-bubble: #238636;
  --glia-user-text: #ffffff;
  --glia-agent-bubble: #21262d;
  --glia-agent-text: #e6edf3;
  --glia-thinking-bg: rgba(139, 92, 246, 0.08);
  --glia-thinking-text: #a78bfa;
  --glia-thinking-border: rgba(139, 92, 246, 0.2);
  --glia-tool-bg: rgba(139, 92, 246, 0.1);
  --glia-tool-text: #a78bfa;
  --glia-tool-border: rgba(139, 92, 246, 0.2);
  --glia-result-bg: rgba(16, 185, 129, 0.1);
  --glia-result-text: #6ee7b7;
  --glia-result-border: rgba(16, 185, 129, 0.25);
  --glia-input-bg: #161b22;
  --glia-input-border: #30363d;
  --glia-primary: #238636;
  --glia-primary-text: #ffffff;
  --glia-font: system-ui, -apple-system, sans-serif;
  --glia-radius: 12px;
  --glia-code-bg: #161b22;
}
```

- [ ] **1.1.1** Crear `sdk/src/styles/base.css` con tokens standalone
- [ ] **1.1.2** Agregar `"exports": { "./styles/base.css": "./dist/styles/base.css" }` en `package.json`
- [ ] **1.1.3** Configurar `tsup.config.ts` para copiar CSS a `dist/styles/`
- [ ] **1.1.4** Verificar: `import '@zea/soma-sdk/styles/base.css'` funciona
- [ ] **1.1.5** Test visual: GliaChat renderiza correctamente sin `zea-design.css` cargado

### 1.2 — Props `colors` en todos los componentes

Cada componente que use `var(--zea-*)` debe aceptar prop `colors` (como ya hace GliaChat).

- [ ] **1.2.1** `GliaCopilot.tsx` — agregar `colors?: Partial<GliaChatColors>` como prop
- [ ] **1.2.2** `GliaConversationList.tsx` — agregar `colors?: Partial<GliaConversationListColors>`
- [ ] **1.2.3** `GliaFileBrowser.tsx` — agregar `colors?: Partial<GliaFileBrowserColors>`
- [ ] **1.2.4** `GliaSkillEditor.tsx` — agregar `colors?: Partial<GliaSkillEditorColors>`
- [ ] **1.2.5** Definir types de colors para cada componente (o reusar `GliaChatColors` parcial)
- [ ] **1.2.6** Verificar: todos los componentes renderizan con `colors` override

### 1.3 — Fallback CSS vars

Cuando `--zea-*` no existe, usar `--glia-*` como fallback en todos los inline styles.

- [ ] **1.3.1** `GliaChat.tsx` — revisar que todos los `var(--zea-*)` tengan fallback `var(--glia-*, default)`
- [ ] **1.3.2** `GliaCopilot.tsx` — mismo review
- [ ] **1.3.3** `GliaConversationList.tsx` — mismo review
- [ ] **1.3.4** `GliaFileBrowser.tsx` — mismo review
- [ ] **1.3.5** `GliaSkillEditor.tsx` — mismo review

---

## Fase 2 — Endpoints Configurables

**Objetivo:** No asumir estructura de backend Soma. Todo parametrizable.

### 2.1 — `wsPath` en UseGliaOptions

- [ ] **2.1.1** Agregar `wsPath?: string` a `UseGliaOptions` (default `'/agent-ws'`)
- [ ] **2.1.2** Modificar `useGlia.ts` — construir URL con `wsPath` en vez de hardcodeado
- [ ] **2.1.3** Test: `wsPath="/custom-ws"` funciona correctamente

### 2.2 — `apiPrefix` en hooks API

- [ ] **2.2.1** Agregar `apiPrefix?: string` a `useGliaConversations`, `useGliaFiles`, `useGliaSkills`, `useGliaAgents`
- [ ] **2.2.2** Default: `'/api/v1'`
- [ ] **2.2.3** Test: `apiPrefix="/api/v2"` genera URLs correctas

### 2.3 — `authHeaders` factory

- [ ] **2.3.1** Agregar `authHeaders?: () => Record<string, string>` a `UseGliaOptions` y hooks API
- [ ] **2.3.2** Default: `() => ({ 'x-api-key': apiKey })` (backward compatible)
- [ ] **2.3.3** `useGlia.ts` — usar `authHeaders()` al abrir WebSocket (si es necesario)
- [ ] **2.3.4** `api.ts` — usar `authHeaders()` en cada fetch
- [ ] **2.3.5** Test: `authHeaders: () => ({ Authorization: 'Bearer token' })` funciona

### 2.4 — `onAuthError` callback

- [ ] **2.4.1** Agregar `onAuthError?: (status: number) => void` a `UseGliaOptions` y hooks API
- [ ] **2.4.2** Llamar `onAuthError` cuando fetch retorna 401 o 403
- [ ] **2.4.3** Test: callback se dispara con API key inválida

---

## Fase 3 — Publicación & Documentación

**Objetivo:** `npm install @zea/soma-sdk` funcione en cualquier proyecto.

### 3.1 — README.md

- [ ] **3.1.1** Crear `sdk/README.md` con:
  - Badges (version, license, bundle size)
  - Quick start (3 pasos)
  - API reference (cada componente/hook)
  - Ejemplo mínimo funcional
  - Sección de theming
  - Sección de backend requirements
  - Link a ejemplos

### 3.2 — Configuración de publicación

- [ ] **3.2.1** Agregar `publishConfig` en `package.json` (registry URL)
- [ ] **3.2.2** Agregar `repository`, `bugs`, `homepage` en `package.json`
- [ ] **3.2.3** Agregar `keywords` en `package.json`
- [ ] **3.2.4** Verificar: `npm pack` produce tarball correcto

### 3.3 — CI/CD

- [ ] **3.3.1** Crear `.github/workflows/sdk-publish.yml`
- [ ] **3.3.2** Steps: checkout → install → build → test → publish
- [ ] **3.3.3** Publicar solo en push a `main` con tag `sdk-v*`

### 3.4 — CHANGELOG

- [ ] **3.4.1** Crear `sdk/CHANGELOG.md`
- [ ] **3.4.2** Documentar versión actual y cambios

### 3.5 — Ejemplo mínimo

- [ ] **3.5.1** Crear `sdk/examples/basic-react/`
- [ ] **3.5.2** Vite + React + GliaChat (sin ZEA, sin Thalamus)
- [ ] **3.5.3** `README.md` del ejemplo con instrucciones
- [ ] **3.5.4** Verificar: `npm install && npm run dev` funciona

---

## Fase 4 — Sandbox Abstraction

**Objetivo:** `GliaFileBrowser` funcione con cualquier storage (S3, GCS, filesystem, memoria).

### 4.1 — Interfaz `SandboxProvider`

- [ ] **4.1.1** Crear `sdk/src/sandbox/types.ts` con:
```typescript
export interface SandboxFile {
  name: string
  type: 'file' | 'dir'
  size: number
  ext?: string
}

export interface SandboxProvider {
  listFiles(path: string): Promise<SandboxFile[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  mkdir(path: string): Promise<void>
  history?(path: string): Promise<{ hash: string; message: string }[]>
}
```

### 4.2 — Providers

- [ ] **4.2.1** `RestSandboxProvider` — implementación actual (fetch a `/api/v1/files`)
- [ ] **4.2.2** `MemorySandboxProvider` — para tests y demos
- [ ] **4.2.3** Exportar ambos providers

### 4.3 — Hook `useSandbox`

- [ ] **4.3.1** Crear `sdk/src/hooks/useSandbox.ts`
- [ ] **4.3.2** Reemplaza a `useGliaFiles` — acepta `SandboxProvider`
- [ ] **4.3.3** Deprecar `useGliaFiles` (mantener por backward compat)

### 4.4 — `GliaFileBrowser` con provider

- [ ] **4.4.1** Agregar prop `sandbox?: SandboxProvider`
- [ ] **4.4.2** Si no se pasa, usar `RestSandboxProvider` con `apiKey`/`baseUrl` (backward compat)
- [ ] **4.4.3** Test: `MemorySandboxProvider` muestra archivos en memoria

---

## Fase 5 — Identity Service Abstraction

**Objetivo:** Agentes desde cualquier backend, no solo Thalamus.

### 5.1 — Interfaz `AgentProvider`

- [ ] **5.1.1** Crear `sdk/src/agents/types.ts` con:
```typescript
export interface AgentConfig {
  systemPrompt?: string
  skills?: string[]
  tools?: string[]
  workspacePaths?: string[]
  engine?: 'pi' | 'react' | 'opencode' | 'hermes' | 'goose'
}
  id: string
  email?: string
  isAgent: boolean
  config?: AgentConfig
}

export interface AgentProvider {
  listAgents(): Promise<Agent[]>
  getAgent(id: string): Promise<Agent | null>
  updateConfig(id: string, config: Partial<AgentConfig>): Promise<void>
}
```

### 5.2 — Providers

- [ ] **5.2.1** `RestAgentProvider` — implementación actual (fetch a `/api/v1/agents`)
- [ ] **5.2.2** `StaticAgentProvider` — agentes hardcodeados (para demos)
- [ ] **5.2.3** Exportar ambos providers

### 5.3 — `useGlia` con `agentConfig` directo

- [ ] **5.3.1** Agregar `agentConfig?: AgentConfig` a `UseGliaOptions`
- [ ] **5.3.2** Si se pasa `agentConfig`, usarlo directamente (sin identity service)
- [ ] **5.3.3** Si NO se pasa, mantener comportamiento actual (WebSocket init con uid)
- [ ] **5.3.4** Test: `<GliaChat agentId="x" agentConfig={{ systemPrompt: 'Hola', tools: ['read'] }} />`

---

## Fase 6 — Multi-Engine Backend

**Objetivo:** Cada agente puede usar un motor de IA distinto (Pi, ReAct, OpenCode, Hermes, Goose).
**Doc completa:** `ENGINE_REGISTRY.md`

### 6.1 — Interfaces y Registry

- [ ] **6.1.1** Crear `server/engines/types.ts` — `AgentEngine`, `AgentSession`, `StreamEvent`, `AgentConfig`
- [ ] **6.1.2** Crear `server/engines/registry.ts` — `EngineRegistry.register()`, `.get()`, `.list()`

### 6.2 — Pi Engine (extraer lógica actual)

- [ ] **6.2.1** Crear `server/engines/pi-engine.ts` — mover `createAgentSession` desde `agent-rpc.ts`
- [ ] **6.2.2** Adaptar subscribe de Pi al formato `StreamEvent` unificado

### 6.3 — Stubs de motores nuevos

- [ ] **6.3.1** `server/engines/react-engine.ts` — stub (throw not implemented)
- [ ] **6.3.2** `server/engines/opencode-engine.ts` — stub
- [ ] **6.3.3** `server/engines/hermes-engine.ts` — stub
- [ ] **6.3.4** `server/engines/goose-engine.ts` — stub

### 6.4 — Refactor agent-rpc.ts

- [ ] **6.4.1** Registrar todos los engines al iniciar
- [ ] **6.4.2** En `ws.on('init')`: leer `config.engine`, resolver con `EngineRegistry.get()`
- [ ] **6.4.3** Default: `engine = 'pi'` si no está configurado
- [ ] **6.4.4** Error 400 si el engine no existe

### 6.5 — Configuración del motor por agente

- [ ] **6.5.1** Agregar campo `engine` a `AgentConfig` en `agent-rpc.ts`
- [ ] **6.5.2** Leer `engine` desde Thalamus (`agent_config.engine`)
- [ ] **6.5.3** Leer `engine` desde archivo local (`config.json`)
- [ ] **6.5.4** Agregar soporte en `PUT /api/agents/:id/config` (Elixir)

### 6.6 — Tests

- [ ] **6.6.1** Test: 2 agentes simultáneos con distinto engine
- [ ] **6.6.2** Test: agente sin engine → usa `pi` por defecto
- [ ] **6.6.3** Test: engine desconocido → error 400

---

## Progreso

| Fase | Tareas | Completadas | Estado |
|------|--------|-------------|--------|
| 1 — CSS | 15 | 0 | ⬜ Pendiente |
| 2 — Endpoints | 12 | 0 | ⬜ Pendiente |
| 3 — Publicación | 13 | 0 | ⬜ Pendiente |
| 4 — Sandbox | 12 | 0 | ⬜ Pendiente |
| 5 — Identity | 15 | 0 | ⬜ Pendiente |
| 6 — Multi-Engine | 20 | 0 | ⬜ Pendiente |
| 7 — OS Sandboxes | 10 | 0 | ⬜ Pendiente |
| **Total** | **95** | **0** | |

---

## Cómo usar este archivo

```bash
# Marcar tarea completada:
# Cambiar [ ] por [x] en el checkbox

# Validar fase completa:
cd /Users/dev/Documents/zea/soma && ./doctor-soma.sh

# Testear SDK en proyecto externo:
cd /tmp && npm create vite@latest test-soma -- --template react-ts
cd test-soma && npm install /Users/dev/Documents/zea/soma/sdk
```
