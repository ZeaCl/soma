#!/bin/bash
# pre-commit-secrets.sh — bloquea commits con datos sensibles
# Uso: .pre-commit-config.yaml → entry: scripts/pre-commit-secrets.sh

set -euo pipefail

RED='\033[0;31m'
NC='\033[0m'
FOUND=0

scan_file() {
    local file="$1"
    local line_num=0

    while IFS= read -r line; do
        line_num=$((line_num + 1))

        # API keys (OpenAI, Anthropic, DeepSeek, Google, Stripe, etc.)
        if echo "$line" | grep -qE 'sk-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}|rk_live_[A-Za-z0-9]{24,}|pk_live_[A-Za-z0-9]{24,}|sess-[A-Za-z0-9]{20,}'; then
            echo -e "  ${RED}🔑 API key${NC}       $file:$line_num"
            FOUND=1
        fi

        # JWT tokens
        if echo "$line" | grep -qE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'; then
            echo -e "  ${RED}🎫 JWT token${NC}     $file:$line_num"
            FOUND=1
        fi

        # Private keys
        if echo "$line" | grep -qE '-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----'; then
            echo -e "  ${RED}🔐 Private key${NC}   $file:$line_num"
            FOUND=1
        fi

        # Passwords hardcodeados en código
        if echo "$line" | grep -qE '(password|passwd|pwd|secret)\s*[:=]\s*["'"'"'][^"'"'"']{8,}["'"'"']'; then
            # Ignorar strings vacíos o placeholders
            if ! echo "$line" | grep -qE '(CHANGE_ME|REPLACE|YOUR_|example|placeholder|xxxx)'; then
                echo -e "  ${RED}🔒 Password${NC}      $file:$line_num"
                FOUND=1
            fi
        fi

        # UUIDs que parecen reales (no 00000000-... ni ffffffff-...)
        if echo "$line" | grep -qE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'; then
            if ! echo "$line" | grep -qE '00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff|deadbeef-dead-beef-dead-beefdeadbeef'; then
                echo -e "  ${RED}🆔 UUID real${NC}     $file:$line_num (¿es un ID de org/usuario?)"
                FOUND=1
            fi
        fi
    done < "$file"
}

# Solo escanear archivos staged
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

# Extensiones a escanear (código y config, no binarios)
SCAN_EXTENSIONS="\.(sh|bash|zsh|py|js|ts|jsx|tsx|ex|exs|rb|go|rs|java|kt|swift|yaml|yml|json|toml|ini|cfg|conf|env|md|txt|sql|graphql|proto|tf|hcl|Dockerfile|Makefile)$"

for file in $STAGED_FILES; do
    # Saltar binarios y archivos ignorados
    if echo "$file" | grep -qE "$SCAN_EXTENSIONS"; then
        # Saltar archivos en gitignore
        if git check-ignore -q "$file" 2>/dev/null; then
            continue
        fi
        scan_file "$file"
    fi
done

if [ "$FOUND" -eq 1 ]; then
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⛔ DATOS SENSIBLES DETECTADOS                           ║${NC}"
    echo -e "${RED}║                                                          ║${NC}"
    echo -e "${RED}║  Si es un falso positivo:                                ║${NC}"
    echo -e "${RED}║    git commit --no-verify                                ║${NC}"
    echo -e "${RED}║                                                          ║${NC}"
    echo -e "${RED}║  Si es un secreto real:                                  ║${NC}"
    echo -e "${RED}║    1. Eliminá el dato del archivo                        ║${NC}"
    echo -e "${RED}║    2. Si ya estaba en git: rotá la clave/credencial      ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi

exit 0
