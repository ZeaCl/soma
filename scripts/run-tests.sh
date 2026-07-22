#!/bin/bash
# ============================================================================
# run-tests.sh — Ejecuta tests de Soma con PostgreSQL efímero (Docker)
# ============================================================================
# Uso:
#   ./scripts/run-tests.sh              # mix test
#   ./scripts/run-tests.sh --cover      # mix coveralls.json
#   ./scripts/run-tests.sh --watch      # mix test.watch (si instalado)
#
# El contenedor de PostgreSQL se crea al inicio y se destruye al final.
# Puerto: 5433 (para no colisionar con el PostgreSQL de desarrollo en 5432)
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DB_PORT="${TEST_DB_PORT:-5433}"
DB_USER="postgres"
DB_PASS="postgres"
DB_NAME="soma_test"
CONTAINER_NAME="soma-test-db"

MODE="${1:-test}"

# ── Colores ──
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

cleanup() {
  echo -e "\n${CYAN}🧹 Limpiando...${NC}"
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}

trap cleanup EXIT

echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}🧪 Soma Test Suite${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo ""

# ── 1. Limpiar contenedor previo ────────────────────────────────────────
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# ── 2. Levantar PostgreSQL efímero ──────────────────────────────────────
echo -e "${CYAN}🐘 Levantando PostgreSQL efímero (port $DB_PORT)...${NC}"
docker run -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "$DB_PORT:5432" \
  postgres:16-alpine \
  > /dev/null

# ── 3. Esperar a que PostgreSQL esté listo ──────────────────────────────
echo -n "   Esperando..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    echo -e " ${GREEN}listo${NC} (${i}s)"
    break
  fi
  sleep 1
  echo -n "."
done

# Verificar que está listo
if ! docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
  echo -e "\n${RED}❌ PostgreSQL no arrancó después de 30s${NC}"
  exit 1
fi

# ── 4. Ejecutar tests ───────────────────────────────────────────────────
export MIX_ENV=test
export DATABASE_URL="ecto://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"

cd "$PROJECT_DIR"

# Asegurar deps compiladas en MIX_ENV=test
mix deps.get --only test 2>/dev/null || true
mix compile --warnings-as-errors 2>/dev/null || true

echo ""

case "$MODE" in
  --cover|cover|coveralls)
    echo -e "${CYAN}📊 Ejecutando tests con cobertura...${NC}"
    mix coveralls.json
    ;;
  --watch|watch)
    echo -e "${CYAN}👀 Ejecutando tests en modo watch...${NC}"
    mix test.watch
    ;;
  *)
    echo -e "${CYAN}🧪 Ejecutando tests...${NC}"
    mix test
    ;;
esac

EXIT_CODE=$?

# ── 5. Report ───────────────────────────────────────────────────────────
echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ All tests passed${NC}"
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
else
  echo -e "${RED}══════════════════════════════════════════${NC}"
  echo -e "${RED}❌ Tests failed (exit $EXIT_CODE)${NC}"
  echo -e "${RED}══════════════════════════════════════════${NC}"
fi

exit $EXIT_CODE
