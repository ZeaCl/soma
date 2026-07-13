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

### Capa 2: ¿El Pi Sidecar está corriendo?

```bash
docker logs zea_soma_local | grep "Agent RPC WebSocket"
# Debe mostrar: 🚀 Agent RPC WebSocket + HTTP on ws://0.0.0.0:3002
```

### Capa 3: ¿El WebSocket está bien ruteado?

El Caddy debe rutear `/agent-ws` → `soma:3002` (NO a `soma:4084`).

```bash
# Verificar en Caddyfile.local:
grep -A5 "agent-ws" /Users/dev/Documents/zea/zea/Caddyfile.local
# Debe mostrar: reverse_proxy soma:3002
```

### Capa 4: ¿pi CLI funciona?

```bash
docker exec zea_soma_local pi --version   # Debe devolver versión
```

**Test manual de pi**:
```bash
echo 'di hola' | docker exec -i zea_soma_local pi --print --provider deepseek --model deepseek-v4-pro
# Debe responder con texto
```

### Capa 5: ¿El agente tiene config?

```bash
docker exec zea_soma_local cat /app/.pi/agent/settings.json
# Debe tener: {"defaultProvider":"deepseek","defaultModel":"deepseek-v4-pro",...}
```

Si no existe, crearlo:
```bash
docker exec zea_soma_local mkdir -p /app/.pi/agent
docker exec zea_soma_local bash -c 'echo "{\"defaultProvider\":\"deepseek\",\"defaultModel\":\"deepseek-v4-pro\",\"defaultThinkingLevel\":\"high\",\"theme\":\"dark\"}" > /app/.pi/agent/settings.json'
```

### Capa 6: ¿El agente tiene API keys?

```bash
docker exec zea_soma_local printenv | grep DEEPSEEK_API_KEY
# Debe mostrar: DEEPSEEK_API_KEY=sk-...
```

Si no están, agregarlas al `.env` del compose y al servicio `soma` en `docker-compose.local.yml`.

### Capa 7: ¿El agente tiene skills?

```bash
docker exec zea_soma_local find /root/.agents/skills -name "SKILL.md"
# Debe mostrar al menos: fund-management/SKILL.md
```

Si no hay skills, verificar que el Dockerfile tenga `COPY skill/ /root/.agents/skills/`.

### Capa 8: ¿Los permisos son correctos?

```bash
docker exec zea_soma_local find /home/soma-*/.pi -ls
# Los archivos deben ser owned por soma-XXX, NO por root
```

Si son `root:root`, el `copyAgentAuth` no está haciendo chown. Ver commit `2c046bf`.

---

## 🔴 Problemas específicos y soluciones

### 1. Caddy no rutea /agent-ws al sidecar

- **Síntoma**: Chat no responde, WebSocket se conecta pero no hay eventos
- **Causa**: Caddy rutea todo a soma:4084 (Elixir API), no a :3002 (Pi Sidecar)
- **Diagnóstico**:
  ```bash
  grep "agent-ws" /Users/dev/Documents/zea/zea/Caddyfile.local
  ```
- **Solución**: Agregar ruteo específico en Caddyfile:
  ```
  @ws { path /agent-ws }
  handle @ws { reverse_proxy soma:3002 }
  ```
- **Prevención**: Ver commit `fa977ee` en `ZeaCl/zea`

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

### 7. API keys LLM no configuradas

- **Síntoma**: pi no puede llamar a la API del proveedor LLM
- **Causa**: `DEEPSEEK_API_KEY` no está en el entorno del contenedor
- **Diagnóstico**:
  ```bash
  docker exec zea_soma_local printenv | grep DEEPSEEK
  ```
- **Solución**: Agregar `DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}` al environment del servicio `soma` en el compose
- **Prevención**: Ver commit `fa977ee` en `ZeaCl/zea`

### 8. copyAgentAuth no hace chown

- **Síntoma**: `EACCES: permission denied, mkdir 'settings.json.lock'`
- **Causa**: `copyAgentAuth` copia archivos como root pero pi corre como soma-XXX
- **Diagnóstico**:
  ```bash
  docker exec zea_soma_local find /home/soma-*/.pi -ls | head
  # Si muestra root:root → problema confirmado
  ```
- **Solución**: Agregar `chown` después de copiar en `agent-sandbox.ts`
- **Prevención**: Ver commit `2c046bf` en `ZeaCl/soma`

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
  1. Frontend (useGlia) envía `token` en mensaje `init` del WebSocket
  2. agent-rpc lo guarda en `process.env.ZEA_TOKEN`
  3. rpc-bridge lo pasa como variable de entorno al subproceso pi
  4. pi puede usar `$ZEA_TOKEN` para llamar a fm_funds, fm_investors, etc.
- **Diagnóstico**: Verificar logs de init: debe mostrar `🔑 ZEA_TOKEN: NNN chars`
- **SDK requerido**: `@zea.cl/soma-sdk@0.1.3` o superior

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
```
