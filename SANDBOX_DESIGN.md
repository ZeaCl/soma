# Soma AgentHub — OS-Level Sandbox Design

> Cada agente es un **usuario real del sistema operativo** con su propio `$HOME`, UID, grupos, y permisos Linux.
> El kernel garantiza el aislamiento — no hay path traversal que validar en aplicación.

---

## Principio

```
Agente = Usuario Linux
Sandbox = /home/soma/{agentId}
Aislamiento = permisos del kernel (chown, chmod, umask)
Compartir   = grupos Linux + bind mounts
Persistencia = volumen Docker montado en /home/soma
```

---

## Modelo

```
═══ Linux ═══════════════════════ ═══ Soma ══════════════════════════════

/etc/passwd             → Thalamus (identity)
/etc/group              → Organizaciones y equipos
/home/soma/{agentId}    → Sandbox aislado del agente
uid=1001                → agentId = "full-stack-dev"
uid=1002                → agentId = "code-reviewer"
groups=1001(soma),1002(org-1) → membresía a orgs/equipos
sudo -u agent command   → Ejecución de tools (bash, edit, write)
chmod 700 /home/soma/X  → Kernel bloquea acceso de otro agente
mount --bind /shared    → Directorios compartidos visibles
```

---

## Jerarquía de archivos

```
/home/soma/
├── {agent-uuid-1}/              ← $HOME del agente (uid=2001)
│   ├── workspace/               ← directorio de trabajo (chown 2001:2001, 700)
│   ├── .config/                 ← configs del agente
│   ├── .pi-sessions/            ← sesiones de Pi (persistencia)
│   ├── shared/                  ← bind mount → /workspace/orgs/{orgId}/shared
│   └── equipo-finanzas/         ← bind mount → /workspace/teams/finanzas
│
├── {agent-uuid-2}/              ← $HOME del agente (uid=2002)
│   ├── workspace/
│   ├── shared/                  ← mismo /workspace/orgs/{orgId}/shared
│   └── datos/                   ← bind mount → /mnt/datos-mercado (ro)
│
└── _bootstrap/                  ← scripts y templates base
    ├── .bashrc
    └── .gitconfig
```

```
/workspace/
├── orgs/{orgId}/
│   ├── shared/                  ← compartido para todos los agentes de la org
│   └── apps/{app}/
│       └── AGENTS.md
│
└── teams/{teamId}/              ← compartido para agentes de un equipo
    └── proyecto-x/
```

---

## Creación de usuario-agente

```bash
#!/bin/bash
# soma-agent-useradd — crea el usuario Linux para un agente

AGENT_ID="$1"
ORG_ID="$2"
TEAMS="$3"          # CSV: team-1,team-2
MOUNTS="$4"         # JSON: [{"source":"/workspace/orgs/x/shared","dest":"shared","ro":false}]

USERNAME="soma-${AGENT_ID:0:12}"        # truncar a 12 chars para compatibilidad
HOMEDIR="/home/soma/${AGENT_ID}"
SHELL="/bin/bash"
UID_BASE=2000

# 1. Crear grupo primario (mismo nombre que usuario)
groupadd --force "$USERNAME"

# 2. Crear usuario con home aislado
useradd \
  --home-dir "$HOMEDIR" \
  --shell "$SHELL" \
  --gid "$USERNAME" \
  --no-create-home \
  --uid "$((UID_BASE + $(date +%s % 50000)))" \
  "$USERNAME"

# 3. Agregar a grupo global de agentes
usermod -aG soma-agents "$USERNAME"

# 4. Agregar a grupo de la organización
groupadd --force "org-${ORG_ID}"
usermod -aG "org-${ORG_ID}" "$USERNAME"

# 5. Agregar a grupos de equipos
for team in $(echo "$TEAMS" | tr ',' ' '); do
  groupadd --force "team-${team}"
  usermod -aG "team-${team}" "$USERNAME"
done

# 6. Crear home directory
mkdir -p "$HOMEDIR/workspace"
mkdir -p "$HOMEDIR/.config"
mkdir -p "$HOMEDIR/.pi-sessions"

# 7. Copiar templates base
cp /home/soma/_bootstrap/.bashrc "$HOMEDIR/"
cp /home/soma/_bootstrap/.gitconfig "$HOMEDIR/"

# 8. Permisos: solo el agente puede acceder a su home
chown -R "$USERNAME:$USERNAME" "$HOMEDIR"
chmod 700 "$HOMEDIR"
chmod 700 "$HOMEDIR/workspace"

# 9. Montar volúmenes compartidos
echo "$MOUNTS" | jq -c '.[]' | while read -r mount; do
  source=$(echo "$mount" | jq -r '.source')
  dest=$(echo "$mount" | jq -r '.dest')
  ro=$(echo "$mount" | jq -r '.ro // false')

  mkdir -p "$HOMEDIR/$dest"

  if [ "$ro" = "true" ]; then
    mount --bind -o ro "$source" "$HOMEDIR/$dest"
  else
    mount --bind "$source" "$HOMEDIR/$dest"
  fi
done

echo "✅ Agent user created: $USERNAME (uid=$UID) home=$HOMEDIR"
```

---

## Ejecución de tools

Cuando el agente ejecuta una herramienta (`bash`, `edit`, `write`), el motor ejecuta el comando como el usuario del agente:

```typescript
// engines/pi-engine.ts

async function execAsAgent(agentId: string, command: string): Promise<string> {
  const username = `soma-${agentId.slice(0, 12)}`

  // sudo -u ejecuta el comando como ese usuario
  // El kernel aplica los permisos de ese UID/GID
  const { stdout, stderr } = await exec(`sudo -u ${username} bash -c '${command}'`)

  return stdout || stderr
}
```

```
═══ Flujo de ejecución ═══

Agente pide:  "Creá un archivo hola.txt con 'HOLA'"
  → Engine traduce: bash -c 'echo HOLA > workspace/hola.txt'
  → sudo -u soma-abc123 bash -c 'echo HOLA > /home/soma/abc.../workspace/hola.txt'
  → Kernel verifica: ¿UID 2001 tiene write en /home/soma/abc.../workspace/?
  → ✅ Sí → archivo creado
  → Result: "Archivo creado"

Agente malicioso pide: "Leé /home/soma/xyz789/workspace/secrets.env"
  → Engine traduce: bash -c 'cat /home/soma/xyz789/workspace/secrets.env'
  → sudo -u soma-abc123 bash -c 'cat /home/soma/xyz789/workspace/secrets.env'
  → Kernel verifica: ¿UID 2001 tiene read en /home/soma/xyz789/...? (chmod 700)
  → ❌ Permission denied
  → Result: "cat: /home/soma/xyz789/workspace/secrets.env: Permission denied"
```

---

## Volúmenes compartidos

```
═══ Escenarios ═══

1. Dos agentes misma org → ven /workspace/orgs/{orgId}/shared
   ├── agente-1: mount --bind /workspace/orgs/org-1/shared /home/soma/abc/shared
   └── agente-2: mount --bind /workspace/orgs/org-1/shared /home/soma/def/shared
   → Kernel: ambos pueden leer/escribir si el grupo org-1 tiene permisos

2. Volumen externo (Docker/NFS) → montado en /mnt/datos-mercado
   → mount --bind -o ro /mnt/datos-mercado /home/soma/abc/datos
   → Agente solo puede leer (ro)

3. Agentes en equipo financiero → ven /workspace/teams/finanzas
   → groupadd team-finanzas
   → usermod -aG team-finanzas soma-abc
   → chgrp team-finanzas /workspace/teams/finanzas
   → chmod 770 /workspace/teams/finanzas
   → Solo agentes en el grupo pueden leer/escribir

4. Agente efímero (preview) → home temporal
   → useradd soma-preview-XYZ --home /tmp/soma-preview-XYZ
   → Al destruir el preview: userdel -r soma-preview-XYZ
   → mount --bind se deshace automáticamente
```

---

## Integración con el engine

```typescript
// engines/pi-engine.ts — executeTool

async function executeTool(
  agentId: string,
  tool: 'read' | 'bash' | 'edit' | 'write',
  params: Record<string, string>
): Promise<string> {
  const username = agentToUsername(agentId)
  const homeDir = agentHomeDir(agentId)

  switch (tool) {
    case 'bash': {
      // sudo -u asegura que el proceso corre con los permisos del agente
      return execSudo(username, `cd ${homeDir}/workspace && ${params.command}`)
    }

    case 'read': {
      const resolved = resolvePath(homeDir, params.path)
      return execSudo(username, `cat "${resolved}"`)
    }

    case 'write': {
      const resolved = resolvePath(homeDir, params.path)
      // Garantizar que el directorio existe y tiene permisos correctos
      await execSudo(username, `mkdir -p "$(dirname '${resolved}')"`)
      return execSudo(username, `cat > "${resolved}"`, params.content)
    }

    case 'edit': {
      const resolved = resolvePath(homeDir, params.path)
      // sed -i para reemplazo exacto
      const escaped = params.oldText.replace(/'/g, `'\\''`)
      const replacement = params.newText.replace(/'/g, `'\\''`)
      return execSudo(username, `sed -i "s/${escaped}/${replacement}/g" "${resolved}"`)
    }
  }
}

function agentToUsername(agentId: string): string {
  return `soma-${agentId.slice(0, 12)}`
}

function agentHomeDir(agentId: string): string {
  return `/home/soma/${agentId}`
}

function resolvePath(homeDir: string, relativePath: string): string {
  // El kernel ya bloquea path traversal con sudo -u.
  // Pero resolvemos relativo a home como defensa extra.
  const resolved = path.resolve(homeDir, relativePath)
  if (!resolved.startsWith(homeDir)) {
    throw new Error(`Path traversal blocked: ${relativePath}`)
  }
  return resolved
}
```

---

## API de administración

```bash
# Crear usuario-agente
curl -X POST /api/agents/{agentId}/sandbox \
  -d '{"orgId":"org-1", "mounts":[{"source":"/workspace/orgs/org-1/shared","dest":"shared"}]}'

# Resultado: useradd + mkdir + chown + bind mounts

# Listar agentes (como usuarios Linux)
curl /api/agents → incluye uid, gid, groups de cada agente

# Destruir sandbox
curl -X DELETE /api/agents/{agentId}/sandbox
# Resultado: userdel -r + umount binds
```

```bash
# Doctor check: verificar que cada agente tiene su usuario Linux
for agent_id in $(ls /home/soma/ | grep -v _bootstrap); do
  username="soma-${agent_id:0:12}"
  if id "$username" &>/dev/null; then
    echo "✅ $agent_id → $username ($(id -u $username))"
  else
    echo "❌ $agent_id → usuario Linux no encontrado"
  fi
done
```

---

## Docker / Infraestructura

```yaml
# docker-compose.yml — Soma AgentHub
services:
  soma:
    volumes:
      # Persistencia de homes de agentes
      - soma_agents:/home/soma
      # Volúmenes compartidos por organización
      - soma_orgs:/workspace/orgs
      # Volumen para datos externos (mercado, datasets)
      - ./data/mercado:/mnt/datos-mercado:ro
    cap_add:
      - SYS_ADMIN     # Necesario para mount --bind
    security_opt:
      - apparmor:unconfined  # O perfil AppArmor custom

volumes:
  soma_agents:         # Homes de agentes (persistente)
  soma_orgs:           # Workspaces de organizaciones
```

---

## Plan de implementación

| # | Tarea | Esfuerzo |
|---|-------|----------|
| 1 | `scripts/soma-agent-useradd` — script de creación de usuario | 1h |
| 2 | `scripts/soma-agent-userdel` — script de destrucción | 30m |
| 3 | `lib/soma/sandbox.ex` — módulo Elixir que wrappea useradd/mount | 2h |
| 4 | `POST/DELETE /api/agents/:id/sandbox` — endpoints de administración | 1h |
| 5 | `server/engines/pi-engine.ts` — adaptar executeTool para sudo -u | 2h |
| 6 | `server/engines/react-engine.ts` — mismo adapter | 1h |
| 7 | Doctor check: verificar usuarios Linux por agente | 30m |
| 8 | Test: agente A no puede leer archivos de agente B | 1h |
| 9 | Test: bind mount compartido funciona entre 2 agentes | 1h |
| 10 | `SANDBOX_DESIGN.md` — este documento | ✅ |

**Esfuerzo total: ~10 horas**

---

## Comparación: antes vs después

```
═══ Antes (aplicación) ═══════════════════════════════════════

/workspace/orgs/{orgId}/
  ├── app1/
  └── app2/
      ↑
      Todos los agentes de la org comparten mismo path.
      Aislamiento simulado en Elixir (resolve → path traversal check).
      Si el check falla → agente puede leer/escribir cualquier archivo.

═══ Después (kernel) ═════════════════════════════════════════

/home/soma/{agentId}/              ← uid=2001, chmod 700
  ├── workspace/                   ← solo uid 2001
  └── shared/                      ← bind mount, grupo org-1

/home/soma/{agentId2}/             ← uid=2002, chmod 700
  ├── workspace/                   ← solo uid 2002
  └── shared/                      ← mismo bind mount, grupo org-1

Kernel: uid 2001 no puede leer /home/soma/{agentId2}/
        → Permission denied (ni siquiera listar el directorio)

Kernel: uid 2001 SÍ puede leer /home/soma/{agentId1}/shared/
        → grupo org-1 tiene rwx en /workspace/orgs/org-1/shared
```
