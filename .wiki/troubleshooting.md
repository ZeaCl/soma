# Troubleshooting — Soma AgentHub

Guía de diagnóstico y solución para los problemas más comunes encontrados durante el desarrollo e integración de Soma.

---

## 🚨 El chat no responde — Debug capa por capa

Seguí estos pasos en orden. Cada paso te dice si el problema está en esa capa.

### Capa 1: ¿Están vivos los servicios?

```bash
curl http://soma.zea.localhost/health        # Debe devolver {"status":"ok"}
curl http://sudlich-soma.zea.localhost       # Debe devolver HTTP 200
curl http://auth.zea.localhost/api/public/health  # Debe devolver HTTP 200
```

### Capa 2: ¿pi CLI funciona?

```bash
docker exec zea_soma_local pi --version   # Debe devolver versión
```

**Test manual de pi**:
```bash
echo 'di hola' | docker exec -i zea_soma_local pi --print --provider deepseek --model deepseek-v4-pro
# Debe responder con texto
```

### Capa 3: ¿El agente tiene config?

```bash
docker exec zea_soma_local cat /app/.pi/agent/settings.json
# Debe tener: {"defaultProvider":"deepseek","defaultModel":"deepseek-v4-pro",...}
```

Si no existe, crearlo:
```bash
docker exec zea_soma_local mkdir -p /app/.pi/agent
docker exec zea_soma_local bash -c 'echo "{\"defaultProvider\":\"deepseek\",\"defaultModel\":\"deepseek-v4-pro\",\"defaultThinkingLevel\":\"high\",\"theme\":\"dark\"}" > /app/.pi/agent/settings.json'
```

### Capa 4: ¿El agente tiene API keys?

Las API keys ya NO se leen de variables de entorno del contenedor. Soma usa `SecretProvider` para resolverlas desde Thalamus (`GET /api/internal/secrets/resolve`) por org y usuario.

```bash
# Verificar que Thalamus tiene secrets configurados:
zea thalamus secret list
```

Si no hay secrets, crearlos:
```bash
zea thalamus secret create --name deepseek --provider deepseek --value <api-key>
```

### Capa 5: ¿El agente tiene skills?

```bash
docker exec zea_soma_local find /root/.agents/skills -name "SKILL.md"
# Debe mostrar al menos: fund-management/SKILL.md
```

Si no hay skills, verificar que el Dockerfile tenga `COPY skill/ /root/.agents/skills/`.

### Capa 6: ¿El WebSocket /agent-ws responde?

El WebSocket lo maneja directamente Elixir vía `WebSockAdapter.upgrade`. **NO hay sidecar Node.js** — la arquitectura de dos procesos (Elixir API + Pi Sidecar) está deprecada.

```bash
# Test directo al endpoint de Elixir:
wscat -c ws://soma.zea.localhost/agent-ws
# Debe aceptar la conexión (aunque falle init sin token, no debe dar 502)
```

Si da 502, verificar logs de Elixir:
```bash
docker logs zea_soma_local | grep -E "AgentSocket|agent-ws|error"
```

### Capa 7: ¿Los permisos son correctos?

```bash
docker exec zea_soma_local find /home/soma-*/.pi -ls
# Los archivos deben ser owned por soma-XXX, NO por root
```

---

## 🔴 Problemas específicos y soluciones

### 1. 502 Bad Gateway en WebSocket /agent-ws

- **Síntoma**: `zea soma chat` o `wscat -c wss://soma.zea.cl/agent-ws` devuelve 502
- **Causa más común**: La imagen de prod no está actualizada, o `WebSockAdapter.upgrade` está fallando
- **Diagnóstico**:
  ```bash
  # Verificar que el endpoint responde (sin WebSocket):
  curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    https://soma.zea.cl/agent-ws
  # Ver logs del contenedor:
  docker logs zea_soma | grep -E "AgentSocket|error|crash"
  ```
- **Arquitectura actual**: Elixir (:4084) maneja REST + WebSocket. NO hay sidecar en :3002.
- **Caddy en prod**: Todo rutea a `soma:4084`, sin ruteo especial para `/agent-ws`.

### 2. Redirect URI no persiste en Thalamus

- **Síntoma**: Login OAuth2 falla con "Invalid redirect_uri"
- **Causa**: Las seeds de Thalamus se ejecutan en cada deploy y resetean redirect_uris
- **Diagnóstico**:
  ```bash
  docker exec zea_postgres_local psql -U postgres -d thalamus_prod \
    -c "SELECT 'sudlich-soma' = ANY(redirect_uris) FROM oauth2_clients WHERE client_id_string='platform_web';"
  ```
- **Solución**: Agregar la URI a `thalamus/priv/repo/seeds.exs` en `platform_web_uris`
- **Prevención**: Ver commit `c6b56699` en `ZeaCl/thalamus`

### 3. CORS bloquea requests del frontend

- **Síntoma**: `Access to fetch at '...' blocked by CORS policy`
- **Causa**: El dominio del frontend no está en `CORS_ORIGINS` de Thalamus
- **Diagnóstico**:
  ```bash
  grep CORS_ORIGINS /Users/dev/Documents/zea/zea/docker-compose.local.yml | grep thalamus
  ```
- **Solución**: Agregar el dominio a `CORS_ORIGINS` en el compose
- **Prevención**: Ver commit `eda747c` en `ZeaCl/zea`

### 4. Skills no persisten en Docker build

- **Síntoma**: `fetchAgentSkills` retorna vacío, skills=[] en logs de init
- **Causa**: El Dockerfile no copia las skills al contenedor
- **Diagnóstico**:
  ```bash
  docker exec zea_soma_local find /root/.agents/skills -name "SKILL.md"
  ```
- **Solución**: Agregar `COPY skill/ /root/.agents/skills/` al Dockerfile
- **Prevención**: Ver commit `f8539de` en `ZeaCl/soma`

### 5. fetchAgentSkills retorna vacío (chicken-and-egg)

- **Síntoma**: `skills=[]` en logs de init incluso con skills en `/root/.agents/skills/`
- **Causa**: `fetchAgentSkills` lee del home del agente (vacío en primer init)
- **Diagnóstico**: Ver logs del init
- **Solución**: Agregar fallback a `/root/.agents/skills/` si el home está vacío
- **Prevención**: Ver commit `32abfa6` en `ZeaCl/soma`

### 6. Config de pi ausente

- **Síntoma**: pi arranca pero no genera respuestas, no hay errores visibles
- **Causa**: `/app/.pi/agent/settings.json` no existe → pi no sabe qué provider/model usar
- **Diagnóstico**:
  ```bash
  docker exec zea_soma_local ls /app/.pi/agent/settings.json
  ```
- **Solución**: Crear el archivo en el Dockerfile:
  ```dockerfile
  RUN mkdir -p /app/.pi/agent && echo '{"defaultProvider":"deepseek",...}' > /app/.pi/agent/settings.json
  ```
- **Prevención**: Ver commit `fea6dcc` en `ZeaCl/soma`

### 7. API keys LLM no configuradas (SecretProvider)

- **Síntoma**: pi no puede llamar a la API del proveedor LLM, error `no_ai_provider_configured`
- **Causa**: No hay secrets configurados en Thalamus para esta org
- **Diagnóstico**:
  ```bash
  zea thalamus secret list
  ```
- **Solución**: Crear el secret en Thalamus:
  ```bash
  zea thalamus secret create --name deepseek --provider deepseek --value <api-key>
  ```
- **Flujo**: `AgentRunner` → `SecretProvider.resolve_secret(org_id, user_id, "deepseek")` → `ThalamusClient.resolve_secret/3` → `GET /api/internal/secrets/resolve`

---

## 🤖 Problemas con proveedores LLM

### DeepSeek no responde en RPC mode

- **Síntoma**: pi recibe el prompt pero no emite `text_delta`/`thinking_delta`
- **Causa**: DeepSeek con thinking level "high" tarda 15-25s en empezar a responder
- **Diagnóstico**: Esperar al menos 30s o probar con `--print` mode
- **Solución**: Tener paciencia. La respuesta llega, solo tarda.
- **Modelo correcto**: `deepseek-v4-pro` o `deepseek-v4-flash` (NO `deepseek-chat`)

### Anthropic: credit balance too low

- **Síntoma**: `"Your credit balance is too low to access the Anthropic API"`
- **Causa**: Crédito agotado en la cuenta de Anthropic
- **Solución**: Recargar créditos en console.anthropic.com o usar DeepSeek

---

## 🔑 ZEA_TOKEN

### El agente no tiene acceso a las APIs de Fund Management

- **Síntoma**: La skill `fund-management` está cargada pero `$ZEA_TOKEN` está vacío
- **Flujo correcto**:
  1. Frontend (useSoma/SomaChat) envía `token` en mensaje `init` del WebSocket
  2. `AgentSocket.handle_init` verifica el JWT y pasa `token` al `AgentRunner`
  3. `AgentRunner` incluye `ZEA_TOKEN` en las variables de entorno al spawnear `pi`
  4. pi puede usar `$ZEA_TOKEN` para llamar a fm_funds, fm_investors, etc.
- **Diagnóstico**: Verificar logs de init: debe mostrar `🔑 ZEA_TOKEN: NNN chars`
- **SDK requerido**: `@zea.cl/soma-sdk@0.2.0` o superior

---

## 🧪 Tests rápidos de diagnóstico

```bash
# Health integral
for url in soma.zea.localhost/health sudlich-soma.zea.localhost auth.zea.localhost/api/public/health; do
  echo -n "$url → "; curl -s -o /dev/null -w "%{http_code}" http://$url; echo ""
done

# Pi funciona
echo '{"type":"prompt","message":"di hola"}' | timeout 30 docker exec -i zea_soma_local pi --mode rpc --session-dir /tmp/diag --provider deepseek --model deepseek-v4-pro 2>&1 | grep -E "text_delta|error|done" | head -3

# Skills disponibles
docker exec zea_soma_local find /root/.agents/skills -name "SKILL.md" | wc -l
echo " skills en /root/.agents/skills/"

# Config de pi
docker exec zea_soma_local cat /app/.pi/agent/settings.json 2>/dev/null || echo "Falta settings.json"

# WebSocket health (debe aceptar conexión, no 502)
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" http://soma.zea.localhost/agent-ws 2>&1 | head -5
```
