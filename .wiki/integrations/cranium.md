# Cranium — Shell de Plataforma

- **URL**: `http://api.zea.localhost` (local) / `https://api.zea.cl` (prod)
- **Auth**: JWT Bearer + header `x-zea-org-id`
- **Repositorio**: `/Users/dev/Documents/zea/cranium`

## Endpoints que Soma consume/expone

Soma NO consume Cranium directamente — es al revés. Las apps que usan CraniumShell integran Soma vía:

1. **SDK** (`@zea.cl/soma-sdk`) — componentes React que se renderizan dentro del shell
2. **Pieces API** (`POST /api/v1/pieces`) — registrar microfrontends de Soma como pieces

## Integración típica (Sudlich)

```tsx
// App.tsx
<CraniumShell
  config={{ apiKey, baseUrl, orgId }}
  sidebarSections={[
    { id: 'agenthub', label: 'agenthub', content: <SomaPanel /> },
  ]}
  showRight={true}
  rightPiece={<GliaChat agentId={...} baseUrl="http://soma.zea.localhost" />}
/>
```

## Registrar pieces de Soma

```bash
curl -X POST http://api.zea.localhost/api/v1/pieces \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-zea-org-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "...",
    "name": "GliaChat",
    "slug": "glia",
    "url": "/mf/glia.html",
    "render_mode": "iframe",
    "icon": "psychology",
    "section": "Workspace"
  }'
```

## Limitaciones / Quirks

- `table` y `dashboard` render modes tienen bugs conocidos → usar `iframe`
- Pieces de la API y sidebarSections de React pueden duplicarse → ocultar API pieces con CSS
- El header `x-zea-org-id` es obligatorio en todas las requests a Cranium API
- Navegación entre pieces usa `pushState` + `popstate`, no `window.location.href`
