# Soma CLI — Test Plan

> Casos de prueba con criterios de aceptación para `zea-soma` v0.2.0

---

## Setup para tests

```bash
export ZEA_TOKEN="token_válido"
export AGENT_ID="4c4e2791-026b-4508-a2c3-1580bf86b661"
export USER_ID="c0000000-852c-44e5-aee1-a761ec76eaea"
export ORG_ID="5fd11ea0-852c-44e5-aee1-a761ec76eaea"
CLI="node cli/index.js"
```

---

## 1. Smoke tests — ¿compila y arranca?

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 1.1 | Syntax check | `node --check cli/index.js && node --check cli/commands/*.js` | Sin errores |
| 1.2 | `--help` | `$CLI --help` | Muestra 9 familias de comandos + opciones globales |
| 1.3 | `--version` | `$CLI --version` | `0.2.0` |
| 1.4 | `--zea-discover` | `$CLI --zea-discover` | JSON válido con 34 comandos |
| 1.5 | Comando sin args | `$CLI` | Muestra help (no crashea) |
| 1.6 | Comando inexistente | `$CLI no-existe` | Error claro, exit code ≠ 0 |

---

## 2. Health & conectividad

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 2.1 | Health ok | `$CLI health` | `✅ Soma AgentHub · Status: ok · Service: soma` |
| 2.2 | Health sin red | `SOMA_URL=http://no-existe:9999 $CLI health` | `❌ No se pudo conectar` — exit 1 |
| 2.3 | Health con --json | `$CLI --json health` | `{"status":"ok","service":"soma"}` |

---

## 3. Agent

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 3.1 | List sin token | `$CLI agent list` | `No hay agentes disponibles` o tabla |
| 3.2 | List con token | `ZEA_TOKEN=... $CLI agent list` | Tabla con columnas ID, Nombre, Engine, Skills, Tipo |
| 3.3 | Show existente | `$CLI agent show $AGENT_ID` | Muestra nombre, engine, skills, system prompt |
| 3.4 | Show no existe | `$CLI agent show no-existe` | `Agente no encontrado` — exit 1 |
| 3.5 | Show con --json | `$CLI --json agent show $AGENT_ID` | JSON con `data.id`, `data.agent_config` |
| 3.6 | Create | `$CLI agent create --name "TestCLI" --engine pi` | `✅ Agente creado: ...` |
| 3.7 | Create con skills | `$CLI agent create --name "Test2" --skills "xlsx,user-sandbox"` | `Skills: xlsx, user-sandbox` |
| 3.8 | Config | `$CLI agent config $AGENT_ID --model deepseek-v4` | `✅ Configuración actualizada` |
| 3.9 | Share | `$CLI agent share $AGENT_ID --with $USER_ID` | `✅ Agente compartido` |
| 3.10 | Unshare | `$CLI agent unshare $AGENT_ID --user $USER_ID` | `✅ Agente descompartido` |
| 3.11 | Delete | `$CLI agent delete <id>` | `✅ Agente eliminado` |

**Criterio general**: Exit 0 en éxito, exit 1 en error. Mensajes en español.

---

## 4. Skill

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 4.1 | List | `$CLI skill list` | Tabla con Nombre, Origen, Descripción. ≥ 1 skill |
| 4.2 | List --json | `$CLI --json skill list` | Array JSON con objetos `{name, description, custom}` |
| 4.3 | Show existente | `$CLI skill show fund-management` | Contenido markdown entre separadores `─` |
| 4.4 | Show no existe | `$CLI skill show no-existe` | `Skill no encontrado` — exit 1 |
| 4.5 | Create | `$CLI skill create --name "test-skill" --file ./test.md` | `✅ Skill creado: test-skill` |
| 4.6 | Create sin --file | `$CLI skill create --name "x"` | Error de opción requerida |
| 4.7 | Edit | `$CLI skill edit "test-skill" --file ./new.md` | `✅ Skill actualizado` |
| 4.8 | Assign | `$CLI skill assign "test-skill" --agents "$AGENT_ID"` | `✅ Skill 'test-skill' asignado a 1 agente(s)` |
| 4.9 | Delete | `$CLI skill delete "test-skill"` | `✅ Skill eliminado` |

---

## 5. Conversations

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 5.1 | List | `$CLI conv list` | Tabla con ID, Agente, Msgs, Último mensaje |
| 5.2 | List vacío | `$CLI conv list` (sin conversaciones) | `No hay conversaciones` (no crashea) |
| 5.3 | Show | `$CLI conv show <conv-id>` | Muestra mensajes con 👤/🤖, timestamps |
| 5.4 | Show no existe | `$CLI conv show no-existe` | `Conversación no encontrada` — exit 1 |
| 5.5 | Show --json | `$CLI --json conv show <id>` | JSON con `{id, title, messages: [...]}` |
| 5.6 | Delete | `$CLI conv delete <conv-id>` | `✅ Conversación eliminada` |

---

## 6. Chat (WebSocket) ⭐

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 6.1 | One-shot | `$CLI chat $AGENT_ID -p "Hola"` | `🧠 Conectando... ✅ Listo` → respuesta → exit 0 |
| 6.2 | One-shot con --json | `$CLI --json chat $AGENT_ID -p "Hola"` | No crashea (streaming no usa --json) |
| 6.3 | Thinking visible | `$CLI chat $AGENT_ID -p "pregunta compleja"` | Muestra `🧠 .....` durante thinking |
| 6.4 | Tool calls visibles | `$CLI chat $AGENT_ID -p "ls /app"` | Muestra `🔧 bash` y resultado |
| 6.5 | Agent inválido | `$CLI chat no-existe -p "hola"` | `❌ Error` o timeout |
| 6.6 | Sin token | `ZEA_TOKEN="" $CLI chat $AGENT_ID -p "hola"` | `❌ Unauthorized` |
| 6.7 | Timeout conexión | Bloquear red → `$CLI chat $AGENT_ID -p "hola"` | `❌ Timeout de conexión (15s)` en ≤ 15s |
| 6.8 | --continue | `$CLI chat $AGENT_ID --continue <conv-id> -p "hola"` | Usa el conv-id dado, no genera uno nuevo |
| 6.9 | Pipe stdin | `echo "Hola" \| $CLI chat $AGENT_ID` | Toma stdin como prompt |
| 6.10 | Pipe + -p | `echo "Contexto" \| $CLI chat $AGENT_ID -p "Resumí"` | Concatena stdin + prompt |

---

## 7. Sandbox

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 7.1 | Create user | `$CLI sandbox create $USER_ID --org $ORG_ID` | `✅ Creado: user-... · Home: /home/user-... · UID: ...` |
| 7.2 | Create sin --org | `$CLI sandbox create $USER_ID` | Error de opción requerida |
| 7.3 | Create con --type agent | `$CLI sandbox create $AGENT_ID --org $ORG_ID --type agent` | `✅ Creado: soma-...` |
| 7.4 | Files | `$CLI sandbox files $USER_ID` | Lista archivos con íconos 📁/📄 y tamaños |
| 7.5 | Files vacío | `$CLI sandbox files <id-nuevo> --type agent` | `📭 Sin archivos` |
| 7.6 | Files con --path | `$CLI sandbox files $USER_ID --path "excel/"` | Filtra por subdirectorio |
| 7.7 | Destroy | `$CLI sandbox destroy $USER_ID` | `✅ Sandbox destruido` |

---

## 8. Files

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 8.1 | List user | `$CLI files list --user $USER_ID` | Lista archivos con tamaños |
| 8.2 | List --json | `$CLI --json files list --user $USER_ID` | JSON con `{files: [...], owner_type: "user"}` |
| 8.3 | Upload | `$CLI files upload ./package.json --user $USER_ID` | `📤 Subiendo package.json (317 B)... ✅` |
| 8.4 | Upload archivo no existe | `$CLI files upload ./no-existe --user $USER_ID` | `Archivo no encontrado` — exit 1 |
| 8.5 | Read | `$CLI files read "package.json"` (si existe en el workspace) | Contenido entre separadores `─` |
| 8.6 | Read no existe | `$CLI files read "no-existe"` | `Archivo no encontrado` — exit 1 |
| 8.7 | Mkdir | `$CLI files mkdir "test-dir"` | `✅ Directorio creado: test-dir` |
| 8.8 | Rename | `$CLI files rename "test-dir" --new-name "test-renamed"` | `✅ Renombrado → test-renamed` |
| 8.9 | Move | `$CLI files move "test-renamed" "moved-dir"` | `✅ Movido → moved-dir` |
| 8.10 | Delete | `$CLI files delete "moved-dir"` | `✅ Eliminado: moved-dir` |
| 8.11 | History | `$CLI files history "package.json"` | Lista commits con hash, mensaje, fecha |
| 8.12 | History sin historial | `$CLI files history "archivo-nuevo"` | `Sin historial` (exit 0) |
| 8.13 | Recover | `$CLI files recover "package.json" --commit <hash>` | `✅ Recuperado` |
| 8.14 | Push | `$CLI files push` | `✅ Push exitoso` o error descriptivo |

---

## 9. API Key

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 9.1 | Create | `$CLI api-key create --name "Test CLI"` | `✅ API key creada: zs_live_...` |
| 9.2 | Create con scopes | `$CLI api-key create --name "ReadOnly" --scopes "soma:read"` | Key creada, scopes limitados |
| 9.3 | Create --json | `$CLI --json api-key create --name "Test"` | `{"api_key":"zs_live_...","prefix":"zs_live_"}` |
| 9.4 | Create sin --name | `$CLI api-key create` | Error de opción requerida |

---

## 10. Doctor

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 10.1 | Doctor completo | `$CLI doctor` | Corre 8 checks, muestra resumen |
| 10.2 | Doctor sin agentes | `$CLI doctor` (sin agentes en Thalamus) | Checks de WS/chat devuelven ❌, no crashean |
| 10.3 | Doctor sin token | `ZEA_TOKEN="" $CLI doctor` | Checks REST ok, WS/chat ❌ |
| 10.4 | Tiempo máximo | `timeout 30 $CLI doctor` | Termina en < 30s (timeouts de 5s y 15s) |

---

## 11. Flags globales

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 11.1 | --json en list | `$CLI --json agent list` | Array JSON, sin formato tabulado |
| 11.2 | --json en show | `$CLI --json skill show fund-management` | Objeto JSON con name, content, source |
| 11.3 | --json en health | `$CLI --json health` | `{"status":"ok","service":"soma"}` |
| 11.4 | --token explícito | `$CLI --token "$ZEA_TOKEN" agent list` | Usa el token del flag |
| 11.5 | --base-url | `$CLI --base-url "http://otro:9999" health` | `❌ No se pudo conectar` |

---

## 12. i18n

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 12.1 | Español (default) | `$CLI health` | `✅ Soma AgentHub · Status: ok` |
| 12.2 | Cambiar a inglés | Editar `lib/i18n.js`: `import t from './locales/en.js'` | `✅ Soma AgentHub · Status: ok · Service: soma` |
| 12.3 | Descripciones en --help | `$CLI agent --help` (EN) | `List available agents`, `Show agent details` |
| 12.4 | Errores traducidos | `$CLI agent show no-existe` (EN) | `Agent not found` |
| 12.5 | --zea-discover (EN) | `$CLI --zea-discover` (EN) | `"AgentHub & AI interaction"` |

---

## 13. Manejo de errores

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 13.1 | API caída | Apagar Soma → `$CLI health` | `❌ No se pudo conectar` — exit 1 |
| 13.2 | Token inválido | `ZEA_TOKEN="basura" $CLI agent list` | Error HTTP 401 (no crashea) |
| 13.3 | Timeout HTTP | `$CLI --base-url "http://10.255.255.1:9999" health` | Error en ≤ 30s (no cuelga infinito) |
| 13.4 | Response no-JSON | (simular endpoint devolviendo HTML) | No crashea, muestra error |
| 13.5 | Ctrl+C durante chat | `$CLI chat $AGENT_ID` → Ctrl+C | Sale limpio sin stack trace |

---

## 14. Integración con zea-cli

| # | Test | Comando | Criterio de aceptación |
|---|---|---|---|
| 14.1 | Binario en PATH | `which zea-soma` | Ruta válida |
| 14.2 | zea-cli descubre | `zea soma health` | Delega a `zea-soma health` |
| 14.3 | --zea-discover desde zea-cli | `zea-soma --zea-discover` | JSON válido |

---

## Resumen

- **Total tests**: 68
- **Cobertura**: 14 áreas, todos los comandos, errores, flags, i18n
- **Ejecutar**: `for t in tests; do run_test $t; done`
- **Exit criteria**: 0 tests fallando en críticos, ≤ 3 en no-críticos
