# Soma AgentHub — Test Cases

> Validación funcional de Soma como hub de agentes multi-tenant.
> Cada caso prueba una capacidad core del sistema.

---

## Arquitectura de referencia

```
┌──────────────────────────────────────────────────────────┐
│                     Soma AgentHub                         │
│                                                           │
│  ┌─────────┐   ┌──────────┐   ┌───────────────────────┐ │
│  │ Identity │   │  Config   │   │     Sandboxes         │ │
│  │ Service  │   │  Service  │   │  /workspace/orgs/{id} │ │
│  │(Thalamus)│   │(Thalamus) │   │  └── app1/            │ │
│  │          │   │           │   │  └── app2/            │ │
│  │ • users  │   │ • skills  │   │  └── AGENTS.md        │ │
│  │ • orgs   │   │ • prompt  │   │  └── .git/            │ │
│  │ • tokens │   │ • tools   │   └───────────────────────┘ │
│  └────┬─────┘   └─────┬─────┘                              │
│       │               │                                    │
│  ┌────▼───────────────▼─────┐   ┌──────────────────────┐  │
│  │     Agent RPC (Pi)       │   │   Soma API (Elixir)  │  │
│  │  ws://host/agent-ws      │   │   :4084              │  │
│  │                          │   │                      │  │
│  │  createAgentSession({    │   │  /api/conversations  │  │
│  │    systemPrompt,         │   │  /api/skills         │  │
│  │    skills,               │   │  /api/files          │  │
│  │    tools,                │   │  /api/agents         │  │
│  │    workspace             │   │  /api/api-keys       │  │
│  │  })                      │   │                      │  │
│  └──────────────────────────┘   └──────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 1. Multi-Tenancy & Organizations

### TC-1.1 — Aislamiento entre organizaciones
```
GIVEN  Org A (id=org-1) tiene files: ["plan.md", "data.csv"]
  AND  Org B (id=org-2) tiene files: ["secrets.env"]
 WHEN  GET /api/files?org=org-1
 THEN  response contiene ["plan.md", "data.csv"]
  AND  NO contiene "secrets.env"
```

### TC-1.2 — API Key por organización
```
GIVEN  Org A tiene API key: zs_live_aaaa...
  AND  Org B tiene API key: zs_live_bbbb...
 WHEN  GET /api/skills  header: x-api-key=zs_live_aaaa
 THEN  skills son las de Org A (custom skills distintos de Org B)
```

### TC-1.3 — Skills custom no se filtran entre orgs
```
GIVEN  Org-1 crea skill "mi-skill" vía POST /api/skills
 WHEN  GET /api/skills con api-key de Org-2
 THEN  "mi-skill" NO aparece
```

---

## 2. Agents = Users (Identity Service)

### TC-2.1 — Agente es un usuario del identity service
```
GIVEN  Thalamus tiene user foo@bar.com con is_agent=true
 WHEN  GET /api/agents
 THEN  foo@bar.com aparece en la lista
  AND  su agent_config contiene skills, system_prompt, workspace_paths
```

### TC-2.2 — Agente sin is_agent NO aparece
```
GIVEN  Thalamus tiene user normal@bar.com con is_agent=false
 WHEN  GET /api/agents
 THEN  normal@bar.com NO aparece
```

### TC-2.3 — Agente pertenece a una organización
```
GIVEN  user agente-1 pertenece a Org-A en Thalamus
 WHEN  se consulta /api/agents con api-key de Org-A
 THEN  agente-1 aparece
 WHEN  se consulta con api-key de Org-B
 THEN  agente-1 NO aparece
```

---

## 3. Agent Configuration Injection

### TC-3.1 — System prompt inyectado en sesión
```
GIVEN  Agent config en Thalamus: system_prompt="Eres un experto en finanzas"
 WHEN  WebSocket init {uid: agent-id}
 THEN  session.prompt("¿Qué eres?") → respuesta menciona "finanzas" o "experto"
```

### TC-3.2 — Skills inyectadas en sesión
```
GIVEN  Agent config en Thalamus: skills=["xlsx", "venture"]
 WHEN  WebSocket init {uid: agent-id}
 THEN  session tiene acceso a read/write de xlsx
  AND  session conoce el dominio "venture"
  AND  session.prompt("Lee el archivo datos.xlsx") → usa herramienta read
```

### TC-3.3 — Cambio de config en caliente (refresh)
```
GIVEN  Agent tiene skills=["xlsx"]
 WHEN  se agrega skill "doctor" vía PUT /api/agents/:id/config
  AND  skillsVersion se incrementa
  AND  nueva conexión WebSocket init
 THEN  session incluye skill "doctor"
  AND  cache de config se invalida (sesión antigua borrada)
```

### TC-3.4 — Config local fallback (Thalamus caído)
```
GIVEN  Thalamus NO responde
  AND  existe /root/.agents/agent-configs/{userId}.json con system_prompt="Fallback prompt"
 WHEN  WebSocket init {uid: userId}
 THEN  session usa "Fallback prompt"
  AND  skills se cargan del filesystem
```

### TC-3.5 — Workspace paths inyectados
```
GIVEN  Agent config: workspace_paths=["/workspace/orgs/org-1/app-fintech"]
 WHEN  session.prompt("¿Qué archivos hay en el workspace?")
 THEN  agente puede leer archivos dentro de /workspace/orgs/org-1/app-fintech
```

---

## 4. Tools Configuration

### TC-4.1 — Tools por defecto
```
GIVEN  agent-rpc.ts tiene tools: ['read', 'bash', 'edit', 'write']
 WHEN  cualquier sesión se crea
 THEN  el agente puede usar esas 4 herramientas
```

### TC-4.2 — Tools configurables por agente (⚠️ HOY NO IMPLEMENTADO)
```
GIVEN  Agent config incluye tools: ["read", "bash"]  (sin "write")
 WHEN  session.prompt("Crea un archivo test.txt")
 THEN  agente NO puede escribir archivos
  AND  responde indicando que no tiene permiso
```

### TC-4.3 — Tools con scoped access
```
GIVEN  Agent tiene tool "bash" limitada a directorio workspace
 WHEN  session.prompt("ls /etc")
 THEN  agente NO puede leer fuera del workspace
```

---

## 5. Sandboxes (Workspace Isolation)

### TC-5.1 — Workspace por organización
```
GIVEN  Org-1 tiene workspace en /workspace/orgs/org-1/
 WHEN  POST /api/files/upload {org: org-1, path: "app/", name: "main.py", data: "..."}
 THEN  archivo se crea en /workspace/orgs/org-1/app/main.py
  AND  git commit registra "write: app/main.py"
```

### TC-5.2 — Sandbox multi-app
```
GIVEN  Org-1 crea dos apps: "app-backend" y "app-frontend"
 WHEN  GET /api/files?path=app-backend
 THEN  lista archivos solo de app-backend
 WHEN  GET /api/files?path=app-frontend
 THEN  lista archivos solo de app-frontend
```

### TC-5.3 — Git history
```
GIVEN  workspace con 3 commits
 WHEN  GET /api/files/history?path=main.py
 THEN  response.commits.length === 3
  AND  cada commit tiene hash + message
```

### TC-5.4 — Git recover
```
GIVEN  main.py modificado 3 veces
 WHEN  POST /api/files/recover {path: "main.py", commit: "<hash-v1>"}
 THEN  main.py vuelve al contenido del commit v1
```

### TC-5.5 — AGENTS.md context
```
GIVEN  /workspace/orgs/org-1/app/AGENTS.md con instrucciones del proyecto
 WHEN  Skills.load_app_context(org-1, "app")
 THEN  devuelve contenido del AGENTS.md
  AND  resuelve referencias a archivos como `design.html`
```

### TC-5.6 — Aislamiento entre sandboxes
```
GIVEN  Org-1 tiene archivo /workspace/orgs/org-1/secrets.env
 WHEN  sesión de Org-2 intenta leer /workspace/orgs/org-1/secrets.env
 THEN  acceso denegado (path traversal bloqueado)
```

---

## 6. API Keys & Auth

### TC-6.1 — Crear API Key
```
WHEN  POST /api/api-keys {name: "prod-key"}
THEN  response.api_key empieza con "zs_live_"
  AND  key_hash se guarda en PostgreSQL (nunca el raw)
```

### TC-6.2 — API Key inválida
```
WHEN  GET /api/conversations  header: x-api-key=zs_live_invalid
THEN  401 {error: "unauthorized", detail: "invalid_api_key"}
```

### TC-6.3 — JWT Auth (browser)
```
GIVEN  token JWT de Thalamus con sub=user_<uuid>
WHEN  GET /api/conversations  header: Authorization=Bearer <jwt>
THEN  200 + conversaciones del usuario
```

### TC-6.4 — JWT sin org_id usa domain_roles
```
GIVEN  JWT claims.domain_roles = [{org_id: "org-1"}]
  AND  no hay header x-zea-org-id
WHEN  GET /api/conversations
THEN  org_id asignado es "org-1"
```

### TC-6.5 — API Key scopes
```
GIVEN  API Key con scopes: ["soma:read"]
WHEN  POST /api/skills (escribe)
THEN  403 Forbidden (scope insuficiente)
```

---

## 7. Conversations & Messages

### TC-7.1 — Crear conversación
```
WHEN  WebSocket init {uid: agent-id, cid: "conv-nueva"}
THEN  conversación "conv-nueva" aparece en GET /api/conversations
```

### TC-7.2 — Persistencia de mensajes
```
GIVEN  conversación "conv-1"
 WHEN  user envía "Hola" → assistant responde "¿En qué ayudo?"
 THEN  GET /api/conversations/conv-1 → messages tiene 2 items
  AND  message[0].role = "user", content = "Hola"
  AND  message[1].role = "assistant", content = "¿En qué ayudo?"
  AND  message[1].thinking contiene el razonamiento del agente
```

### TC-7.3 — Thinking persistido
```
WHEN  user envía un prompt que requiere razonamiento
THEN  el mensaje del assistant incluye campo "thinking" no vacío
```

### TC-7.4 — Multi-turn conversation
```
GIVEN  conv-1 con 2 turnos: user1→agent1, user2→agent2
 WHEN  GET /api/conversations/conv-1
 THEN  messages.length === 4
  AND  orden cronológico preservado
```

### TC-7.5 — Soft delete
```
WHEN  DELETE /api/conversations/conv-1
THEN  200 ok
  AND  conversación ya no aparece en GET /api/conversations
  AND  mensajes NO se borran físicamente (soft delete)
```

---

## 8. Skills Management

### TC-8.1 — Listar skills (builtin + custom)
```
WHEN  GET /api/skills
THEN  response.data contiene skills builtin (del filesystem)
  AND  response.data contiene skills custom (de PostgreSQL)
  AND  cada skill tiene: name, description, custom (bool)
```

### TC-8.2 — Crear skill custom
```
WHEN  POST /api/skills {name: "mi-flujo", content: "# Mi Skill\n..."}
THEN  201 + skill.name = "mi-flujo"
  AND  archivo SKILL.md creado en /app/.pi-agent-skills/mi-flujo/
  AND  guardado en PostgreSQL
```

### TC-8.3 — Skill custom sobreescribe builtin
```
GIVEN  skill builtin "xlsx" existe
 WHEN  POST /api/skills {name: "xlsx", content: "custom xlsx"}
THEN  GET /api/skills → "xlsx" aparece con custom=true
  AND  GET /api/skills/xlsx → contenido es el custom
```

### TC-8.4 — Skill auto-discovery
```
GIVEN  nuevo directorio /app/.pi-agent-skills/nueva-skill/SKILL.md creado
 WHEN  watcher detecta el cambio
 THEN  skill "nueva-skill" se auto-registra para el agente activo
  AND  se sincroniza con Thalamus
```

### TC-8.5 — Asignar skills a agentes
```
WHEN  PUT /api/skills/xlsx/agents {agentIds: ["agent-1", "agent-2"]}
THEN  ambos agentes reciben la skill en Thalamus
  AND  registry local actualizado
```

---

## 9. WebSocket Agent Session

### TC-9.1 — Flujo completo init → ready → prompt → done
```
WHEN  ws.connect → send init → recv ready → send prompt → recv delta* → recv done
THEN  todos los eventos en orden
  AND  done incluye content + thinking acumulados
```

### TC-9.2 — Cancel
```
GIVEN  sesión activa procesando prompt largo
 WHEN  send cancel
 THEN  recv cancelled
  AND  contenido parcial guardado con "⏹️ Cancelado"
```

### TC-9.3 — Reconexión
```
GIVEN  WebSocket se desconecta durante streaming
 WHEN  cliente reconecta y hace init con mismo cid
 THEN  sesión se reanuda (SessionManager.continueRecent)
```

### TC-9.4 — Múltiples sesiones simultáneas
```
GIVEN  2 WebSocket connections con distintos agentId
WHEN  ambos envían prompts en paralelo
THEN  cada uno recibe respuesta independiente
  AND  sin interferencia entre sesiones
```

---

## 10. Observability & Health

### TC-10.1 — Health check
```
WHEN  GET /health
THEN  200 {status: "ok", service: "soma"}
```

### TC-10.2 — Doctor script
```
WHEN  ./doctor-soma.sh
THEN  7 capas verificadas: HTTP, Auth, API, WebSocket, DB, Skills, Agent Response
  AND  todas OK
```

### TC-10.3 — Logs de diagnóstico
```
WHEN  WebSocket session creada
THEN  [useGlia] logs aparecen en browser console:
  "ws open → sending init"
  "← ready, pending: N"
  "← done, content: X thinking: Y contentRef: true"
```

---

## Priorización

| Prioridad | Casos | Estado actual |
|-----------|-------|---------------|
| 🔴 P0 | TC-4.2 Tools configurables | ❌ Hardcodeado `['read','bash','edit','write']` |
| 🔴 P0 | TC-3.1 System prompt inyectado | ✅ Funciona desde Thalamus |
| 🔴 P0 | TC-7.2 Persistencia mensajes | ✅ PostgreSQL |
| 🟡 P1 | TC-4.3 Tools con scope | ❌ No implementado |
| 🟡 P1 | TC-5.5 AGENTS.md context | ✅ Implementado |
| 🟡 P1 | TC-7.3 Thinking persistido | ✅ Implementado (último fix) |
| 🟢 P2 | TC-6.5 API Key scopes | ⚠️ Guardado en DB pero no enforced |
| 🟢 P2 | TC-5.3 Git history/recover | ✅ Implementado |
| 🟢 P2 | TC-8.4 Skill auto-discovery | ✅ Watcher implementado |
