#!/bin/bash
# soma-agent doctor — health checks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

doctor_main() {
  case "${1:-}" in
    run)   doctor_run ;;
    watch) doctor_watch ;;
    *)     echo "Usage: soma-agent doctor <run|watch>"; exit 1 ;;
  esac
}

doctor_run() {
  if [ -f "$SCRIPT_DIR/doctor-soma.sh" ]; then
    bash "$SCRIPT_DIR/doctor-soma.sh"
  else
    echo "❌ doctor-soma.sh not found at $SCRIPT_DIR"
    exit 1
  fi
}

doctor_watch() {
  echo "🩺 Watching Soma health (every 30s, Ctrl+C to stop)"
  while true; do
    clear
    bash "$SCRIPT_DIR/doctor-soma.sh" 2>&1 | head -20
    sleep 30
  done
}
