# @zea/soma-sdk — Portability Plan

> Hoja de ruta para que el SDK sea realmente portable: embeberlo en cualquier app React
> sin depender de la infraestructura ZEA (Thalamus, Caddy, diseño ZEA, etc.).

---

## Estado actual

```
✅ Lo que ya funciona como portable
───────────────────────────────────
• Solo 2 peer deps: react + react-dom
• Todo parametrizado: agentId, apiKey, baseUrl
• Sin URLs hardcodeadas a Thalamus/Soma
• Exports tree-shakeables:
    import { GliaChat } from '@zea/soma-sdk'
    import { useGlia }  from '@zea/soma-sdk/hooks'
• Tipos exportados: GliaMessage, UseGliaOptions, GliaChatProps...
• GliaChat acepta prop colors para override completo de paleta
• useGlia es autónomo: WebSocket + estado, sin dependencias externas

❌ Lo que impide la portabilidad real
──────────────────────────────────────
1. CSS acoplado a ZEA: 14 referencias a var(--zea-*)
   → Solo GliaChat tiene prop colors; los otros 4 componentes NO
2. WebSocket path hardcodeado: /agent-ws
3. API path hardcodeado: /api/v1 en api.ts
4. Auth asume x-api-key + WebSocket sin auth (patrón Soma)
5. Sin README.md en el paquete
6. Sin tema CSS standalone (depende de zea-design.css)
7. Consumo local (file:../sdk) → no publicado en registry
```

---

## Plan de cambios

### Fase 1 — CSS Desacoplado (1-2 días)

```
Objetivo: El SDK funcione visualmente sin zea-design.css
```

| # | Cambio | Archivo | Esfuerzo |
|---|--------|---------|----------|
| 1.1 | Props `colors` en GliaCopilot, GliaConversationList, GliaFileBrowser, GliaSkillEditor | `components/*.tsx` | 2h |
| 1.2 | Generar `glia-base.css` standalone con valores por defecto (sin var(--zea-*)) | Nuevo `styles/base.css` | 2h |
| 1.3 | Exportar `glia-base.css` en package.json → `"exports": { "./styles": "./dist/styles/base.css" }` | `package.json`, `tsup.config.ts` | 30m |
| 1.4 | Fallback: si `--zea-*` no existe, usar valores del prop `colors` o defaults inline | `GliaChat.tsx` | 1h |

```css
/* glia-base.css — standalone, sin dependencia ZEA */
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
  /* ... resto de tokens ... */
}
```

### Fase 2 — Endpoints Configurables (1 día)

```
Objetivo: No asumir estructura de backend Soma
```

| # | Cambio | Archivo | Esfuerzo |
|---|--------|---------|----------|
| 2.1 | `wsPath` opción en UseGliaOptions (default: `'/agent-ws'`) | `useGlia.ts`, `types/index.ts` | 30m |
| 2.2 | `apiPrefix` opción en hooks API (default: `'/api/v1'`) | `api.ts`, `types/index.ts` | 30m |
| 2.3 | `authHeaders` factory en UseGliaOptions: `() => Record<string, string>` | `useGlia.ts`, `types/index.ts` | 1h |
| 2.4 | `onAuthError` callback para manejar 401/403 | `useGlia.ts`, `api.ts` | 1h |

```typescript
// Ejemplo de uso post-fase 2:
<GliaChat
  agentId="my-agent"
  baseUrl="https://my-backend.com"
  wsPath="/custom-ws"
  authHeaders={() => ({ Authorization: `Bearer ${myToken}` })}
/>
```

### Fase 3 — Publicación & Docs (1 día)

```
Objetivo: Instalable vía npm, documentado
```

| # | Cambio | Archivo | Esfuerzo |
|---|--------|---------|----------|
| 3.1 | README.md con: quick start, API reference, ejemplos de integración | Nuevo `sdk/README.md` | 2h |
| 3.2 | `publishConfig` en package.json para GitHub Packages o npm privado | `package.json` | 15m |
| 3.3 | CI: build + publish en push a main | `.github/workflows/sdk-publish.yml` | 1h |
| 3.4 | CHANGELOG.md | Nuevo `sdk/CHANGELOG.md` | 30m |
| 3.5 | Ejemplo mínimo: `examples/basic-react` con Vite + GliaChat sin ZEA | Nuevo `examples/basic-react/` | 1h |

### Fase 4 — Sandbox Abstraction (2-3 días)

```
Objetivo: El concepto "sandbox" sea un contrato, no un filesystem físico
```

| # | Cambio | Archivo | Esfuerzo |
|---|--------|---------|----------|
| 4.1 | Interfaz `SandboxProvider`: `listFiles()`, `readFile()`, `writeFile()`, `deleteFile()` | Nuevo `sandbox/types.ts` | 1h |
| 4.2 | `FilesystemSandboxProvider`: implementación actual (REST a Soma API) | Nuevo `sandbox/fs-provider.ts` | 2h |
| 4.3 | `MemorySandboxProvider`: implementación en memoria para tests/dev | Nuevo `sandbox/memory-provider.ts` | 1h |
| 4.4 | `useSandbox(provider)` hook que reemplace `useGliaFiles` | Nuevo `hooks/useSandbox.ts` | 2h |
| 4.5 | GliaFileBrowser acepta `sandbox` prop en vez de `apiKey`/`baseUrl` | `GliaFileBrowser.tsx` | 1h |

```typescript
// Ejemplo: app externa con su propio storage (S3, GCS, etc.)
const s3Sandbox: SandboxProvider = {
  async listFiles(path) { return s3.listObjects({ Prefix: path }) },
  async readFile(path)  { return s3.getObject({ Key: path }) },
  async writeFile(path, content) { return s3.putObject({ Key: path, Body: content }) },
}

<GliaFileBrowser sandbox={s3Sandbox} />
```

### Fase 5 — Identity Service Abstraction (2-3 días)

```
Objetivo: Agents = Users venga de cualquier identity provider, no solo Thalamus
```

| # | Cambio | Archivo | Esfuerzo |
|---|--------|---------|----------|
| 5.1 | Interfaz `AgentProvider`: `listAgents()`, `getAgent(id)`, `updateConfig(id, config)` | Nuevo `agents/types.ts` | 30m |
| 5.2 | `RESTAgentProvider`: implementación actual (REST a Soma/Thalamus) | Nuevo `agents/rest-provider.ts` | 1h |
| 5.3 | `useAgents(provider)` hook | Nuevo `hooks/useAgents.ts` | 1h |
| 5.4 | `useGlia` acepta `agentConfig` directo (sin necesidad de identity service) | `useGlia.ts` | 1h |

```typescript
// Ejemplo: app que gestiona sus propios agentes sin Thalamus
<GliaChat
  agentId="code-reviewer"
  agentConfig={{
    systemPrompt: "Eres un revisor de código experto en TypeScript...",
    skills: ["code-review"],
    tools: ["read", "bash"],
  }}
/>
```

---

## API final deseada (post-fases)

```typescript
// ── Integración mínima (sin backend ZEA) ──────────
import { GliaChat } from '@zea/soma-sdk'
import '@zea/soma-sdk/styles/base.css'

function App() {
  return (
    <GliaChat
      agentId="my-agent"
      agentConfig={{
        systemPrompt: 'Eres un asistente útil.',
        tools: ['read', 'bash'],
      }}
      wsUrl="wss://my-backend.com/agent-ws"
      authHeaders={() => ({ Authorization: `Bearer ${token}` })}
    />
  )
}

// ── Integración completa (con providers) ──────────
import { GliaChat, GliaFileBrowser, useAgents, useSandbox } from '@zea/soma-sdk'

function App() {
  const sandbox = useSandbox(new S3SandboxProvider({ bucket: 'my-sandbox' }))
  const agents = useAgents(new RESTAgentProvider({ url: '/api' }))

  return (
    <GliaChat
      agentId={selectedAgent}
      wsUrl="/ws"
      authHeaders={authHeaders}
    >
      <GliaFileBrowser sandbox={sandbox} />
    </GliaChat>
  )
}
```

---

## Matriz de dependencias a eliminar

| Dependencia actual | Cómo se elimina | Fase |
|-------------------|-----------------|------|
| `var(--zea-*)` CSS | `glia-base.css` standalone + fallbacks | Fase 1 |
| `/agent-ws` path | `wsPath` configurable | Fase 2 |
| `/api/v1` prefix | `apiPrefix` configurable | Fase 2 |
| `x-api-key` header | `authHeaders` factory | Fase 2 |
| Soma REST API | `SandboxProvider` interface | Fase 4 |
| Thalamus identity | `AgentProvider` interface | Fase 5 |
| `file:../sdk` | Publicar en registry | Fase 3 |
| `@earendil-works/pi-coding-agent` | Solo en server (agent-rpc.ts), no en SDK | N/A |

---

## Esfuerzo total estimado

| Fase | Días | Entregable |
|------|------|------------|
| Fase 1 — CSS | 1-2 | SDK funciona visualmente sin ZEA CSS |
| Fase 2 — Endpoints | 1 | SDK se conecta a cualquier backend |
| Fase 3 — Publicación | 1 | `npm install @zea/soma-sdk` |
| Fase 4 — Sandbox | 2-3 | FileBrowser con cualquier storage |
| Fase 5 — Identity | 2-3 | Agentes sin Thalamus |
| **Total** | **7-10 días** | SDK completamente portable |
