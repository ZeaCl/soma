# Soma AgentHub — Debug Context

## ¿Qué es Soma?

Soma es el **AgentHub** de ZEA Platform. Es un servicio que permite chatear con agentes de IA vía WebSocket usando el Pi SDK. Tiene su propio frontend React (landing, login OAuth2, chat) y backend Elixir + Node.js (Pi sidecar).

URL: `http://soma.zea.localhost`

## Arquitectura del chat

```
Browser (React)
  │
  ├── GliaChat (componente UI)
  │     └── usa useGlia() hook del SDK @zea/soma-sdk
  │           └── WebSocket → ws://soma.zea.localhost/agent-ws
  │
  └── Caddy → soma:3002 (Pi backend Node.js)
                 └── createAgentSession() + session.prompt()
                       └── DEEPSEEK_API_KEY → deepseek/deepseek-chat
```

## El problema

El agente **SÍ responde** y la respuesta se ve en la UI:
- Se muestra el thinking (bloque púrpura colapsable)
- Se muestra el texto de respuesta (delta)

Pero después de 1-2 segundos, **la respuesta desaparece**:
- Desaparece el thinking
- Desaparece el texto delta
- **La pregunta del usuario SÍ queda visible**
- Solo se borra la respuesta del agente

Esto se confirmó con E2E Playwright:
```
t+2s: bubbles=2 feed=347  ← respuesta visible
       ↑ 2 bubbles = welcome + user question
t+4s: bubbles=2 feed=5    ← respuesta borrada, bubbles siguen siendo 2
```

El feed pasa de 347 chars (thinking + delta visibles) a 5 chars.
Las bubbles se mantienen en 2 (el mensaje del usuario NO desaparece).

Esto significa que el `done` event:
1. ✅ Limpia `streamBlocks` (desaparece el contenido en vivo)
2. ❌ NO agrega el mensaje del assistant a `messages` (nunca aparece el bubble)

## Hipótesis principal

**`streamRef.current` está vacío cuando `done` llega**, por lo que `if (streamRef.current)` es falsy y `setMessages` nunca se ejecuta.

En `useGlia`, hay DOS refs con el mismo nombre:
- `useGlia.streamRef` — acumula deltas para el handler `done`
- `GliaChat.streamRef` — acumula bloques para el renderizado

El `onDelta` callback actualiza GliaChat.streamRef (por eso se ve en pantalla),
pero useGlia.streamRef podría no estar actualizándose si hay un bug en el parseo
binario o en el orden de ejecución de los callbacks.

## Fix aplicado (pero aún no resuelve)

```typescript
// useGlia.ts — antes:
ws.onmessage = (event) => {
  try {
    const d = JSON.parse(event.data)  // ❌ falla si event.data es ArrayBuffer
  } catch {}
}

// useGlia.ts — ahora:
ws.onmessage = (event) => {
  try {
    let raw = event.data
    if (raw instanceof ArrayBuffer) {
      raw = new TextDecoder().decode(raw)  // ✅ convierte binary a string
    }
    const d = JSON.parse(raw)
  } catch {}
}
```

## Comportamiento actual post-fix

- El WebSocket conecta ✅
- Se envían init y prompt ✅  
- La respuesta llega pero el feed HTML se mantiene constante (~960 chars) durante 60s
- No se ven `.glia-stream` ni `.glia-thinking` en el DOM
- El agente con algunos prompts ("2+2") devuelve delta, con otros ("Di OK") solo thinking
- El componente NO se remonta (`.glia-root` count se mantiene en 1)

## Hipótesis

1. **`streamRef.current` vacío al llegar `done`**: useGlia tiene su propio `streamRef` que acumula deltas vía `streamRef.current += d.text`. Si el parseo binario falla en `onmessage`, ese ref nunca se llena. Pero el callback `onDelta` pasado por GliaChat SÍ actualiza el `streamRef` DE GLIACHAT (que es otro ref diferente). Resultado: el contenido se ve en pantalla (streamBlocks de GliaChat) pero el `done` handler no persiste el mensaje (streamRef de useGlia vacío).

2. **Fix del binary parseo insuficiente**: `instanceof ArrayBuffer` funciona, pero el WebSocket del navegador podría entregar `Blob` en vez de `ArrayBuffer`. `ws.binaryType` por defecto es `"blob"` en navegadores.

3. **Orden de callbacks**: el `onDelta` callback se pasa como prop a `useGlia`. Si `useGlia` recibe el delta y llama a `onDelta`, pero antes de que React procese el state update de `onDelta`, llega `done` y limpia todo.

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `soma/sdk/src/hooks/useGlia.ts` | Hook que maneja WebSocket, mensajes, streaming |
| `soma/sdk/src/components/GliaChat.tsx` | Componente UI del chat |
| `soma/server/agent-rpc.ts` | Pi backend — WebSocket server, session.prompt() |
| `soma/ui/src/ChatView.tsx` | Layout 3 columnas de Soma |
| `soma/ui/src/App.tsx` | Router: landing → login → chat |
| `soma/e2e/soma-debug.js` | E2E test con monitoreo detallado |
| `soma/doctor-soma.sh` | Health check 7 capas |

## Cómo probar

```bash
# Doctor (7 capas, ~30s)
cd /Users/dev/Documents/zea/soma && ./doctor-soma.sh

# E2E Playwright (flujo completo con monitoreo de frames)
cd /Users/dev/Documents/zea/soma/e2e && node soma-debug.js

# WebSocket directo (funciona)
python3 -c "
import asyncio, json, websockets
async def t():
    async with websockets.connect('ws://soma.zea.localhost/agent-ws') as ws:
        await ws.send(json.dumps({'type':'init','uid':'c0000000-852c-44e5-aee1-a761ec76eaea','cid':'x'}))
        print(await ws.recv())
        await ws.send(json.dumps({'type':'prompt','text':'2+2'}))
        for _ in range(20):
            d = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
            print(d['type'], d.get('text','')[:40])
asyncio.run(t())
"
```
