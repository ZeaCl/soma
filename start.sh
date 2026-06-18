#!/bin/sh
set -e

echo "🧠 Starting Soma..."
echo "   Elixir API: :4084"
echo "   Pi Sidecar: :3002"
echo ""

# ── Bootstrap: sandbox base dirs ──────────────────────────────────
echo "📁 Bootstrap: creando directorios base del sandbox..."
mkdir -p /home
mkdir -p /workspace/orgs
mkdir -p /app/.pi-agent-skills
mkdir -p /app/.pi-agent-messages
mkdir -p /app/.pi-agent-sessions

# ── Bootstrap: recrear usuarios Linux desde homes persistentes ────
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

# Start Pi sidecar with auto-restart
start_pi() {
  cd /app/server
  while true; do
    echo "🚀 Starting Agent RPC..."
    npx tsx agent-rpc.ts 2>&1
    echo "⚠️  Agent RPC exited (code $?). Restarting in 3s..."
    sleep 3
  done
}

start_pi &
PI_PID=$!

# Start Soma Elixir app
cd /app
bin/soma start &
SOMA_PID=$!

# Wait for either to exit
wait -n $SOMA_PID $PI_PID
