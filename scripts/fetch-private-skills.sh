#!/bin/bash
# fetch-private-skills.sh
# Descarga skills con información interna de ZEA desde Thalamus API.
# Se ejecuta en CI antes del docker build.
# Requiere: ZEA_TOKEN o zea CLI autenticado.

set -e

SKILL_DIR="$(dirname "$0")/../skill"
PRIVATE_DIR="$SKILL_DIR/private"
SKILLS=("fund-management" "user-sandbox" "xlsx-import" "soma-agents")

echo "📥 Descargando skills privadas..."

# Crear directorio para skills privadas si no existe
mkdir -p "$PRIVATE_DIR"

for skill in "${SKILLS[@]}"; do
  echo "   🔄 $skill..."

  # Si zea CLI está disponible, usarla
  if command -v zea &>/dev/null; then
    zea soma skill show "$skill" --base-url "${SOMA_URL:-https://soma.zea.cl}" > "$SKILL_DIR/$skill/SKILL.md" 2>/dev/null || {
      echo "   ⚠️  $skill: no disponible vía CLI, buscando en private/"
      # Fallback: si el archivo ya existe en private/ (cache local), usarlo
      if [ -f "$PRIVATE_DIR/$skill/SKILL.md" ]; then
        mkdir -p "$SKILL_DIR/$skill"
        cp "$PRIVATE_DIR/$skill/SKILL.md" "$SKILL_DIR/$skill/SKILL.md"
        echo "   ✅ $skill: desde cache local"
      else
        echo "   ❌ $skill: no disponible. El agente no tendrá esta skill."
      fi
    }
  else
    echo "   ⚠️  zea CLI no disponible, usando cache local"
    if [ -f "$PRIVATE_DIR/$skill/SKILL.md" ]; then
      mkdir -p "$SKILL_DIR/$skill"
      cp "$PRIVATE_DIR/$skill/SKILL.md" "$SKILL_DIR/$skill/SKILL.md"
      echo "   ✅ $skill: desde cache local"
    fi
  fi
done

echo "✅ Skills privadas listas."
ls "$SKILL_DIR/" 2>/dev/null || true
