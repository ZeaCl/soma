#!/bin/sh
set -e

echo "🧠 Starting Soma..."
echo "   Elixir API: :4084"
echo "   Pi Sidecar: :3002"

# Start Pi sidecar in background
cd /app/server
npx tsx agent-rpc.ts &
PI_PID=$!

# Start Soma Elixir app
cd /app
bin/soma start &
SOMA_PID=$!

# Wait for either to exit
wait -n $SOMA_PID $PI_PID
