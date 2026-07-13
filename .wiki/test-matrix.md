# Matriz de Pruebas — Soma x Südlich Integration

> Última actualización: 2026-07-13
> Cobertura: Fases -1, 0, 1, 2, 3

---

## Resumen de Cobertura

| Categoría | Tests | ✅ Pass | ❌ Fail | ⬜ Pendiente |
|---|---|---|---|---|
| Infraestructura | 6 | 6 | 0 | 0 |
| Auth | 5 | 1 | 2 | 2 |
| Microfrontends | 9 | 1 | 0 | 8 |
| Panel Agentes + Chat | 8 | 0 | 0 | 8 |
| Workspace | 8 | 0 | 0 | 8 |
| Regresión | 4 | 1 | 0 | 3 |
| **Total** | **40** | **9** | **2** | **29** |

---

## I — Infraestructura

### I-01: Soma health check
- **Prioridad**: 🔴 Crítica
- **Precondición**: Docker compose corriendo
- **Pasos**:
  1. `curl http://soma.zea.localhost/health`
- **Criterio de aceptación**: Response 200 con `{"status":"ok","service":"soma"}`
- **Estado**: ✅

### I-02: Sudlich-soma health check
- **Prioridad**: 🔴 Crítica
- **Precondición**: Docker compose corriendo
- **Pasos**:
  1. `curl -o /dev/null -w "%{http_code}" http://sudlich-soma.zea.localhost`
- **Criterio de aceptación**: HTTP 200, página de login renderiza
- **Estado**: ✅

### I-03: Sudlich original no afectado
- **Prioridad**: 🔴 Crítica
- **Precondición**: Ambos sudlich y sudlich-soma corriendo
- **Pasos**:
  1. `curl -o /dev/null -w "%{http_code}" http://sudlich.zea.localhost`
- **Criterio de aceptación**: HTTP 200. El sudlich original sigue funcionando sin cambios.
- **Estado**: ✅

### I-04: Soma BD conectada
- **Prioridad**: 🔴 Crítica
- **Precondición**: Soma corriendo
- **Pasos**:
  1. `docker exec zea_soma_local wget -q -O - http://localhost:4084/health`
  2. Revisar logs: `docker logs zea_soma_local | grep "PostgreSQL ready"`
- **Criterio de aceptación**: Logs muestran "PostgreSQL ready — messages persisted"
- **Estado**: ✅

### I-05: Pi Sidecar corriendo
- **Prioridad**: 🔴 Crítica
- **Precondición**: Soma corriendo
- **Pasos**:
  1. `docker logs zea_soma_local | grep "Agent RPC"`
- **Criterio de aceptación**: Logs muestran "Agent RPC WebSocket + HTTP on ws://0.0.0.0:3002"
- **Estado**: ✅

### I-06: Pi CLI disponible
- **Prioridad**: 🟡 Media
- **Precondición**: Soma corriendo
- **Pasos**:
  1. `docker exec zea_soma_local pi --version`
- **Criterio de aceptación**: Muestra número de versión (ej: 0.80.6)
- **Estado**: ⬜

---

## II — Auth

### A-01: Login OAuth2 PKCE exitoso
- **Prioridad**: 🔴 Crítica
- **Precondición**: Thalamus corriendo, usuario `c@zea.cl` desbloqueado
- **Pasos**:
  1. Abrir `http://sudlich-soma.zea.localhost`
  2. Click "INICIAR SESIÓN CON ZEA"
  3. Completar credenciales: `c@zea.cl` / `GusVicentAnto1.`
  4. Autorizar scopes
- **Criterio de aceptación**: Redirige al dashboard de CraniumShell. Sidebar visible.
- **Estado**: ⬜ (cuenta bloqueada temporalmente — desbloqueada vía DB)

### A-02: JWT en localStorage
- **Prioridad**: 🔴 Crítica
- **Precondición**: Login exitoso (A-01)
- **Pasos**:
  1. Abrir DevTools → Application → Local Storage → `sudlich-soma.zea.localhost`
  2. Verificar clave `thalamus_auth`
- **Criterio de aceptación**:
  - `thalamus_auth` existe en localStorage
  - Contiene `accessToken` (JWT válido)
  - Contiene `expiresAt` (timestamp futuro)
- **Estado**: ✅

### A-03: Token propagado a GliaChat
- **Prioridad**: 🔴 Crítica
- **Precondición**: Login exitoso, agente seleccionado
- **Pasos**:
  1. Abrir DevTools → Network → WS
  2. Seleccionar un agente en el sidebar
  3. Verificar handshake WebSocket a `ws://soma.zea.localhost/agent-ws`
- **Criterio de aceptación**:
  - WebSocket se conecta exitosamente (status 101)
  - Primer mensaje enviado es `{"type":"init","uid":"..."}`
- **Estado**: ⬜

### A-04: Token expirado → redirige a login
- **Prioridad**: 🟡 Media
- **Precondición**: Sesión activa
- **Pasos**:
  1. Modificar `expiresAt` en localStorage a un timestamp pasado
  2. Esperar 300ms (polling interval)
- **Criterio de aceptación**: La página hace reload y muestra la landing de login
- **Estado**: ⬜

### A-05: Microfrontend lee token del parent
- **Prioridad**: 🟡 Media
- **Precondición**: Login exitoso, CraniumShell cargado
- **Pasos**:
  1. Navegar a `/pieces/glia` (abre iframe con `/mf/glia/dist/`)
  2. Verificar que GliaChat se renderiza (no muestra "Autenticando...")
- **Criterio de aceptación**: GliaChat muestra el input de chat, no el placeholder de auth
- **Estado**: ⬜

---

## III — Microfrontends

### M-01: GliaChat renderiza en iframe
- **Prioridad**: 🔴 Crítica
- **Precondición**: Login exitoso, agente con ID válido en query params
- **Pasos**:
  1. Navegar a `/pieces/glia?agentId=4c4e2791-026b-4508-a2c3-1580bf86b661`
  2. Esperar carga del iframe
- **Criterio de aceptación**:
  - iframe carga sin errores 404/500
  - GliaChat muestra:
    - Área de mensajes (con welcome message)
    - Input de texto
    - Botón de enviar
  - Tema oscuro (#0d1117 background)
- **Estado**: ⬜

### M-02: GliaChat sin agentId → placeholder
- **Prioridad**: 🟢 Baja
- **Precondición**: Login exitoso
- **Pasos**:
  1. Navegar a `/pieces/glia` (sin query params)
- **Criterio de aceptación**: Muestra "🧬 Selecciona un agente para comenzar"
- **Estado**: ⬜

### M-03: Files — listar archivos
- **Prioridad**: 🟡 Media
- **Precondición**: Login exitoso, sandbox de usuario existe
- **Pasos**:
  1. Navegar a `/pieces/files`
  2. Esperar carga del iframe
- **Criterio de aceptación**:
  - Muestra "📁 Workspace Files"
  - Área de drop zone visible ("Drop files here" o similar)
  - Si hay archivos, se listan
- **Estado**: ⬜

### M-04: Files — upload vía drop zone
- **Prioridad**: 🟡 Media
- **Precondición**: Login exitoso, files MF cargado
- **Pasos**:
  1. Arrastrar un archivo (ej: .csv, .xlsx, .txt) a la drop zone
  2. Esperar upload
- **Criterio de aceptación**:
  - Archivo aparece en la lista
  - Sin errores en consola
  - El archivo existe en el container: `docker exec zea_soma_local ls /home/user-*/workspace/`
- **Estado**: ⬜

### M-05: Skills — listar skills
- **Prioridad**: 🟡 Media
- **Precondición**: Login exitoso, agente con skills asignadas
- **Pasos**:
  1. Navegar a `/pieces/skills`
  2. Esperar carga del iframe
- **Criterio de aceptación**:
  - Muestra "🛠️ Skills"
  - SkillManager renderiza lista de skills (o mensaje "no skills" si vacío)
- **Estado**: ⬜

### M-06: Skills — crear/editar
- **Prioridad**: 🟡 Media
- **Precondición**: Login exitoso, skills MF cargado
- **Pasos**:
  1. Click en crear nueva skill
  2. Completar nombre y contenido markdown
  3. Guardar
- **Criterio de aceptación**:
  - Nueva skill aparece en la lista
  - Se puede editar y los cambios persisten
- **Estado**: ⬜

### M-07: Microfrontends no rompen el shell
- **Prioridad**: 🟡 Media
- **Precondición**: CraniumShell cargado
- **Pasos**:
  1. Navegar a `/pieces/glia`
  2. Navegar a `/pieces/files`
  3. Navegar a `/pieces/skills`
  4. Volver a `/pieces/dashboard`
- **Criterio de aceptación**:
  - Sidebar permanece visible en todas las transiciones
  - No hay full-page reloads
  - La URL cambia sin recargar (pushState)
- **Estado**: ⬜

### M-08: MFs con JWT inválido → auth placeholder
- **Prioridad**: 🟢 Baja
- **Precondición**: Sin token en localStorage
- **Pasos**:
  1. Limpiar localStorage
  2. Navegar a `/pieces/files`
- **Criterio de aceptación**: Muestra "Autenticando..." (no crashea)
- **Estado**: ⬜

### M-09: MFs sirven archivos estáticos correctamente
- **Prioridad**: 🟡 Media
- **Pasos**:
  1. `curl -o /dev/null -w "%{http_code}" http://sudlich-soma.zea.localhost/mf/glia/dist/`
  2. `curl -o /dev/null -w "%{http_code}" http://sudlich-soma.zea.localhost/mf/files/dist/`
  3. `curl -o /dev/null -w "%{http_code}" http://sudlich-soma.zea.localhost/mf/skills/dist/`
- **Criterio de aceptación**: Los 3 devuelven HTTP 200
- **Estado**: ⬜

---

## IV — Panel Agentes + Chat

### P-01: Sidebar muestra sección Agents
- **Prioridad**: 🔴 Crítica
- **Precondición**: Login exitoso
- **Pasos**:
  1. Observar sidebar izquierdo
- **Criterio de aceptación**:
  - Arriba de MANAGEMENT aparece la lista de agentes
  - Cada agente muestra: avatar circular con iniciales, nombre, indicador de estado (círculo verde/gris)
- **Estado**: ⬜

### P-02: Seleccionar agente → GliaChat en panel derecho
- **Prioridad**: 🔴 Crítica
- **Precondición**: Login exitoso, sidebar visible
- **Pasos**:
  1. Click en un agente de la lista
- **Criterio de aceptación**:
  - Panel derecho muestra GliaChat
  - Muestra welcome message
  - Input de chat y botón de enviar visibles
  - Agente seleccionado se resalta en sidebar (fondo distinto)
- **Estado**: ⬜

### P-03: Deseleccionar agente → placeholder
- **Prioridad**: 🔴 Crítica
- **Precondición**: Agente seleccionado, GliaChat visible
- **Pasos**:
  1. Click en el mismo agente (toggle off)
- **Criterio de aceptación**:
  - Panel derecho muestra placeholder "🧬 Selecciona un agente"
  - Agente deja de estar resaltado en sidebar
- **Estado**: ⬜

### P-04: Cambiar de agente → remonta GliaChat
- **Prioridad**: 🟡 Media
- **Precondición**: Agente A seleccionado, chat iniciado
- **Pasos**:
  1. Enviar un mensaje al agente A
  2. Click en agente B en sidebar
- **Criterio de aceptación**:
  - GliaChat se actualiza con el nuevo agente (nuevo welcome message)
  - El chat del agente A se cierra (no se mezclan conversaciones)
- **Estado**: ⬜

### P-05: Chat envía y recibe mensajes
- **Prioridad**: 🔴 Crítica
- **Precondición**: Agente seleccionado, GliaChat visible, WebSocket conectado
- **Pasos**:
  1. Escribir "Hola, ¿quién eres?" en el input
  2. Presionar Enter o click en enviar
- **Criterio de aceptación**:
  - Mensaje del usuario aparece en la conversación (burbuja derecha, color #7c3aed)
  - Agente responde con streaming de texto (burbuja izquierda)
  - Sin errores en consola ni en Network
- **Estado**: ⬜

### P-06: Sidebar no interfiere con navegación de pieces
- **Prioridad**: 🟡 Media
- **Precondición**: Agente seleccionado, GliaChat en panel derecho
- **Pasos**:
  1. Navegar a `/pieces/funds` en el panel central
  2. Navegar a `/pieces/dashboard`
- **Criterio de aceptación**:
  - Panel derecho mantiene GliaChat activo
  - Panel central cambia de contenido correctamente
  - Sidebar mantiene agente seleccionado
- **Estado**: ⬜

### P-07: GliaChat funciona en viewport reducido
- **Prioridad**: 🟢 Baja
- **Precondición**: Agente seleccionado, GliaChat visible
- **Pasos**:
  1. Reducir ancho del viewport a 1024px
- **Criterio de aceptación**:
  - GliaChat se adapta sin overflow horizontal
  - Input y mensajes permanecen usables
- **Estado**: ⬜

### P-08: Agentes offline → fallback mode
- **Prioridad**: 🟡 Media
- **Precondición**: Soma API no disponible
- **Pasos**:
  1. Detener Soma: `docker compose stop soma`
  2. Recargar sudlich-soma
  3. Observar sidebar
- **Criterio de aceptación**:
  - Sidebar muestra "⚠ Modo offline" o mensaje de error
  - Muestra agente fallback hardcodeado (Full Stack Dev)
  - La app no crashea
- **Estado**: ⬜

---

## V — Workspace

### W-01: Subir archivo → persiste en sandbox
- **Prioridad**: 🔴 Crítica
- **Precondición**: Login exitoso, files MF cargado
- **Pasos**:
  1. Subir archivo `test-data.csv` vía drop zone
  2. Verificar en container: `docker exec zea_soma_local find /home -name "test-data.csv"`
- **Criterio de aceptación**:
  - Archivo aparece en el file browser
  - Archivo existe en `/home/user-{id}/workspace/test-data.csv`
  - Permisos: `-rw-------` (700)
- **Estado**: ⬜

### W-02: Descargar archivo del workspace
- **Prioridad**: 🟡 Media
- **Precondición**: Archivo subido (W-01)
- **Pasos**:
  1. Click en el archivo en el file browser
  2. Click en descargar
- **Criterio de aceptación**:
  - Archivo se descarga con el nombre y contenido original
  - Content-Type correcto (text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, etc.)
- **Estado**: ⬜

### W-03: Eliminar archivo del workspace
- **Prioridad**: 🟡 Media
- **Precondición**: Archivo subido
- **Pasos**:
  1. Seleccionar archivo en file browser
  2. Click en eliminar
  3. Confirmar
- **Criterio de aceptación**:
  - Archivo desaparece de la lista
  - Ya no existe en el filesystem: `docker exec zea_soma_local ls /home/user-*/workspace/test-data.csv` → No such file
- **Estado**: ⬜

### W-04: Skills CRUD completo
- **Prioridad**: 🟡 Media
- **Precondición**: Login exitoso, skills MF cargado
- **Pasos**:
  1. Crear skill "test-skill" con contenido "# Test Skill\n\nTest content"
  2. Verificar que aparece en la lista
  3. Editar contenido a "# Updated"
  4. Verificar cambio
  5. Eliminar skill
- **Criterio de aceptación**:
  - Crear → skill aparece
  - Editar → contenido actualizado
  - Eliminar → skill desaparece
- **Estado**: ⬜

### W-05: Workspace aislado por usuario
- **Prioridad**: 🔴 Crítica
- **Precondición**: Dos usuarios diferentes logueados
- **Pasos**:
  1. Usuario A sube `user-a-file.txt`
  2. Usuario B abre files MF
- **Criterio de aceptación**:
  - Usuario B NO ve `user-a-file.txt`
  - Usuario A SÍ ve su archivo
- **Estado**: ⬜

### W-06: Upload rechaza archivos > 100MB
- **Prioridad**: 🟢 Baja
- **Precondición**: Archivo grande disponible
- **Pasos**:
  1. Intentar subir archivo > 100MB
- **Criterio de aceptación**:
  - Muestra mensaje de error "Archivo demasiado grande"
  - No se sube parcialmente
- **Estado**: ⬜

### W-07: Drop zone acepta drag & drop
- **Prioridad**: 🟢 Baja
- **Precondición**: Files MF cargado
- **Pasos**:
  1. Arrastrar archivo del escritorio a la drop zone
- **Criterio de aceptación**:
  - Drop zone muestra estado "hover" (borde resaltado)
  - Al soltar, el archivo se sube
- **Estado**: ⬜

### W-08: File browser navega subdirectorios
- **Prioridad**: 🟢 Baja
- **Precondición**: Archivos en subdirectorios del workspace
- **Pasos**:
  1. Subir archivo a path "excel/2026/reporte.xlsx"
  2. Navegar por el file browser a "excel" → "2026"
- **Criterio de aceptación**:
  - Breadcrumb muestra la ruta actual
  - Archivo `reporte.xlsx` visible en el directorio `2026`
- **Estado**: ⬜

---

## VI — Regresión

### R-01: Sudlich original intacto — login
- **Prioridad**: 🔴 Crítica
- **Precondición**: sudlich y sudlich-soma ambos corriendo
- **Pasos**:
  1. Abrir `http://sudlich.zea.localhost`
  2. Iniciar sesión
  3. Verificar sidebar MANAGEMENT + WORKSPACE
- **Criterio de aceptación**:
  - Login funciona
  - Sidebar muestra las secciones originales (NO Agents)
  - Dashboard, Fondos, LPs, Capital Calls funcionan
- **Estado**: ⬜

### R-02: Sudlich original intacto — microfrontends
- **Prioridad**: 🔴 Crítica
- **Precondición**: Login en sudlich original
- **Pasos**:
  1. Navegar a `/pieces/funds`
  2. Navegar a `/pieces/lps`
  3. Navegar a `/pieces/create-fund`
- **Criterio de aceptación**:
  - Los 3 pieces cargan correctamente
  - Sin referencias a GliaChat o agentes
  - Sin errores 404 por archivos de Soma
- **Estado**: ✅

### R-03: Dos dominios no interfieren
- **Prioridad**: 🟡 Media
- **Precondición**: Ambos corriendo
- **Pasos**:
  1. Abrir `sudlich.zea.localhost` en pestaña 1
  2. Abrir `sudlich-soma.zea.localhost` en pestaña 2
  3. Login en ambas
  4. Interactuar en ambas pestañas simultáneamente
- **Criterio de aceptación**:
  - Cada pestaña funciona independientemente
  - localStorage de una no afecta a la otra
  - Sin CORS errors entre dominios
- **Estado**: ⬜

### R-04: E2E tests existentes no rompen
- **Prioridad**: 🟡 Media
- **Precondición**: Playwright configurado
- **Pasos**:
  1. `cd ~/Documents/zea/sudlich && npx playwright test`
- **Criterio de aceptación**:
  - Los tests del sudlich original pasan sin cambios
- **Estado**: ⬜

---

## Criterios de Aceptación Generales

| # | Criterio | Estado |
|---|---|---|
| GA-01 | `curl http://soma.zea.localhost/health` → 200 | ⬜ |
| GA-02 | `curl http://sudlich-soma.zea.localhost` → 200 | ⬜ |
| GA-03 | `curl http://sudlich.zea.localhost` → 200 (sin cambios) | ⬜ |
| GA-04 | Login OAuth2 PKCE funciona en sudlich-soma | ⬜ |
| GA-05 | JWT se propaga correctamente a todos los microfrontends | ⬜ |
| GA-06 | Sidebar muestra agentes de Soma API | ⬜ |
| GA-07 | Seleccionar agente → GliaChat en panel derecho | ⬜ |
| GA-08 | Chat envía/recibe mensajes vía WebSocket | ⬜ |
| GA-09 | Files: subir, listar, descargar, eliminar archivos | ⬜ |
| GA-10 | Skills: crear, editar, eliminar skills | ⬜ |
| GA-11 | Workspace aislado por usuario (Linux permissions) | ⬜ |
| GA-12 | Sudlich original no afectado en ninguna funcionalidad | ⬜ |

---

## Cómo ejecutar las pruebas

### Health checks rápidos

```bash
# Infraestructura
curl -s http://soma.zea.localhost/health
curl -s -o /dev/null -w "%{http_code}" http://sudlich-soma.zea.localhost
curl -s -o /dev/null -w "%{http_code}" http://sudlich.zea.localhost

# Microfrontends
for mf in glia files skills; do
  echo -n "/mf/$mf/dist/: "
  curl -s -o /dev/null -w "%{http_code}" "http://sudlich-soma.zea.localhost/mf/$mf/dist/"
  echo ""
done

# Pi Sidecar
docker logs zea_soma_local | grep -E "Agent RPC|PostgreSQL ready"
docker exec zea_soma_local pi --version
```

### Tests funcionales (navegador)

```bash
# Abrir ambas apps para test manual
open http://sudlich-soma.zea.localhost
open http://sudlich.zea.localhost
```

### Credenciales de prueba

```
URL:      http://sudlich-soma.zea.localhost
Email:    c@zea.cl
Password: GusVicentAnto1.
Agente:   Full Stack Dev (4c4e2791-026b-4508-a2c3-1580bf86b661)
```

### E2E tests (futuro)

```bash
# Pendiente: agregar tests Playwright para sudlich-soma
cd ~/Documents/zea/sudlich-soma
npx playwright test
```
