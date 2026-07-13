# RPC Bridge — pi --mode rpc

- **Estado**: ✅ merged
- **Issues**: #f4281d3, #406539a

## Qué se hizo

Puente stdin/stdout JSONL entre el Pi Sidecar (Node.js) y el subproceso `pi --mode rpc`. Traduce el protocolo WebSocket del cliente a comandos JSONL que `pi` entiende, y streamea las respuestas de vuelta como eventos tipados.

## Decisiones clave

- **`sudo -u soma-{id}` para ejecución**: más portable que `spawn({uid, gid})`, no requiere capabilities
- **API keys pasadas explícitamente**: `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` como env vars porque `sudo` limpia el entorno
- **`EventEmitter` para eventos**: `text`, `thinking`, `tool_call`, `tool_result`, `done`, `error`
- **Una sesión por bridge**: cada `new RpcBridge()` = un subproceso `pi --mode rpc`

## Protocolo JSONL

### Entrada (stdin)

```jsonl
{"type":"init","payload":{"systemPrompt":"...","provider":"deepseek","model":"deepseek-chat"}}
{"type":"prompt","payload":{"text":"¿Cuál es el NAV del fondo Alpha?"}}
{"type":"cancel","payload":{}}
```

### Salida (stdout)

```jsonl
{"type":"thinking","content":"Analizando la consulta sobre NAV..."}
{"type":"tool_call","tool_name":"read_file","tool_input":{"path":"data/funds.csv"}}
{"type":"tool_result","content":"name,NAV\nAlpha,12.4M\n..."}
{"type":"text","content":"El NAV del fondo Alpha es $12.4M"}
{"type":"done"}
```

## Archivos modificados

- `server/rpc-bridge.ts` — `RpcBridge` class con `start()`, `prompt()`, `cancel()`
- `server/agent-rpc.ts` — integración con WebSocket server
- `server/agent-sandbox.ts` — `prepareAgent()` entrega `{username, home}` al bridge

## Errores encontrados

- **subprocess.stdout no emite líneas completas**: usar `split2` o buffer manual para parsear JSONL línea por línea
- **pi no instalado → bridge no inicia**: verificar con `command -v pi` en bootstrap
- **sudo pide contraseña en algunas imágenes**: el Dockerfile debe incluir `shadow` y configurar sudo sin password
