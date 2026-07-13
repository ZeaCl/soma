# SDK React — @zea.cl/soma-sdk

- **Estado**: ✅ merged
- **Issues**: #9cf63d0, #c70491c, #7bcc2d6, #01764d3, #466d7d1

## Qué se hizo

SDK React público (`@zea.cl/soma-sdk@0.1.2`) con 11 componentes y 7 hooks para integrar Soma en cualquier app React. Publicado en npm público con CI/CD automático.

## Decisiones clave

- **Sin dependencias de UI externas**: inline styles + CSS variables para evitar conflictos con Chakra, MUI, Tailwind
- **Temas vía props `colors`**: Partial<GliaChatColors> permite override de colores individuales
- **WebSocket nativo**: sin dependencia de Phoenix channels, conexión directa a `{baseUrl}/agent-ws`
- **Dos modos de auth**: JWT Bearer (Thalamus) + API Key (Soma), detectado automáticamente
- **Build con tsup**: CJS + ESM + tipos en un solo paso

## Componentes

| Componente | Props clave |
|---|---|
| `GliaChat` | agentId, conversationId?, apiKey?, baseUrl?, colors?, welcomeMessage? |
| `GliaCopilot` | agentId, baseUrl? |
| `GliaConversationList` | agentId, baseUrl?, onSelect? |
| `GliaFileBrowser` | agentId, baseUrl? |
| `GliaFileViewer` | agentId, baseUrl?, file? |
| `GliaSkillEditor` | agentId, baseUrl? |
| `AgentSkillPanel` | agentId, baseUrl? |
| `SomaPanel` | (sin props) |
| `SkillManager` | agentId, baseUrl? |
| `UserWorkspace` | ownerType, ownerId, baseUrl?, authHeaders? |
| `UserFileDropZone` | ownerType, ownerId, baseUrl?, authHeaders? |

## Hooks

| Hook | Retorna |
|---|---|
| `useGlia({agentId, baseUrl?, conversationId?})` | send, cancel, messages, isStreaming, streamContent |
| `useGliaConversations()` | conversations, loading |
| `useGliaFiles()` | files, upload, delete |
| `useGliaFileContent(path)` | content, loading |
| `useGliaSkills()` | skills, update |
| `useGliaAgents()` | agents, create, update |
| `useUserWorkspace({ownerType, ownerId})` | files, upload, delete |

## Build & publish

```bash
cd sdk
npm run build    # tsup → dist/
npm publish      # → @zea.cl/soma-sdk en npm público
```

CI/CD: `.github/workflows/publish-npm.yml` con `NPM_TOKEN`.

## Archivos modificados

- `sdk/package.json` — name, version, exports, peerDependencies
- `sdk/tsup.config.ts` — CJS + ESM + tipos
- `sdk/src/index.ts` — exports
- `sdk/src/components/*.tsx` — 11 componentes
- `sdk/src/hooks/*.ts` — 7 hooks
- `sdk/src/types/index.ts` — interfaces
- `sdk/src/sandbox/*` — REST y memory providers

## Errores encontrados

- **HeadersInit type en REST provider**: `fetch` espera `HeadersInit`, no `Record<string,string>` → fix con type cast
- **ConversationId perdido entre renders**: `useGlia` no memoizaba el WebSocket → fix con `useRef`
- **Skills nil → crash**: Thalamus puede devolver `null` para skillNames → fallback a `[]`
