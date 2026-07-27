#!/bin/sh
set -e

echo "🧠 Starting Soma..."
echo "   Elixir API: :4084"
echo "   Pi Sidecar: :3002"
echo ""

# ── Bootstrap: sandbox base dirs ──────────────────────────────────
echo "📁 Bootstrap: creando directorios base del sandbox..."
mkdir -p /home
mkdir -p /home/orgs
mkdir -p /app/.pi-agent-skills
mkdir -p /app/.pi-agent-messages
mkdir -p /app/.pi-agent-sessions

# ── Bootstrap: recrear usuarios Linux desde homes persistentes ────
# Helper: reparar symlink al workspace compartido si falta o es incorrecto
_fix_shared_symlink() {
  local home="$1" org_id="$2"
  local link="$home/workspace/shared"
  local target="../../orgs/$org_id/shared"
  mkdir -p "/home/orgs/$org_id/shared"
  if [ ! -L "$link" ] || [ "$(readlink "$link" 2>/dev/null || echo '')" != "$target" ]; then
    [ -e "$link" ] || [ -L "$link" ] && rm -rf "$link"
    ln -s "$target" "$link" && echo "   🔗 Symlink reparado: $link → $target"
  fi
}

echo "📁 Bootstrap: recreando usuarios desde /home/soma-*/..."
for home in /home/soma-*/; do
  username=$(basename "$home")
  if ! id "$username" >/dev/null 2>&1; then
    groupadd --force "$username" 2>/dev/null || true
    groupadd --force "org-00000000-0000-0000-0000-000000000000" 2>/dev/null || true
    chown -R 0:0 "$home" 2>/dev/null || true
    useradd --home-dir "$home" --shell /bin/bash --gid "$username" --no-create-home "$username" 2>/dev/null && \
    usermod -aG soma-agents,"org-00000000-0000-0000-0000-000000000000" "$username" 2>/dev/null || true
    chown -R "$username:$username" "$home" 2>/dev/null || true
    echo "   ✅ Agente recreado: $username"
  fi
  # Reparar symlink al workspace compartido si hace falta
  if [ -f "$home/.soma/org_id" ]; then
    _fix_shared_symlink "$home" "$(cat "$home/.soma/org_id")"
  fi
done

echo "📁 Bootstrap: recreando usuarios humanos desde /home/user-*/..."
for home in /home/user-*/; do
  username=$(basename "$home")
  if ! id "$username" >/dev/null 2>&1; then
    groupadd --force "$username" 2>/dev/null || true
    groupadd --force "org-00000000-0000-0000-0000-000000000000" 2>/dev/null || true
    chown -R 0:0 "$home" 2>/dev/null || true
    useradd --home-dir "$home" --shell /bin/bash --gid "$username" --no-create-home "$username" 2>/dev/null && \
    usermod -aG "org-00000000-0000-0000-0000-000000000000" "$username" 2>/dev/null || true
    chown -R "$username:$username" "$home" 2>/dev/null || true
    echo "   ✅ Usuario recreado: $username"
  fi
  # Reparar symlink al workspace compartido si hace falta
  if [ -f "$home/.soma/org_id" ]; then
    _fix_shared_symlink "$home" "$(cat "$home/.soma/org_id")"
  fi
done

# Crear grupo soma-agents si no existe
if ! getent group soma-agents >/dev/null 2>&1; then
  groupadd --force soma-agents 2>/dev/null || addgroup soma-agents 2>/dev/null || true
  echo "   ✅ Grupo soma-agents creado"
fi

# Verificar que pi CLI está disponible
if command -v pi >/dev/null 2>&1; then
  echo "   ✅ pi CLI: $(pi --version 2>/dev/null || echo 'ok')"
else
  echo "   ⚠️  pi CLI no encontrado — los agentes no podrán iniciar"
fi

echo ""

# Start Soma Elixir app in the foreground
cd /app
exec bin/soma start
