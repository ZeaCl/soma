#!/bin/sh
set -e

echo "🧠 Starting Soma..."
echo "   Elixir API: :4084"
echo "   Pi Sidecar: :3002"
echo ""

# ── Bootstrap: sandbox base dirs ──────────────────────────────────
echo "📁 Bootstrap: creando directorios base del sandbox..."
mkdir -p /home/soma
mkdir -p /root/.agents/skills
mkdir -p /app/.pi-agent-skills
mkdir -p /app/.pi-agent-messages
mkdir -p /app/.pi-agent-sessions

# Crear grupo soma-agents si no existe
if ! getent group soma-agents >/dev/null 2>&1; then
  addgroup soma-agents 2>/dev/null || groupadd --force soma-agents 2>/dev/null || true
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
