#!/bin/bash
# soma-agent workspace — file management

workspace_main() {
  case "${1:-}" in
    list)     shift; workspace_list "$@" ;;
    upload)   shift; workspace_upload "$@" ;;
    download) shift; workspace_download "$@" ;;
    mkdir)    shift; workspace_mkdir "$@" ;;
    rm)       shift; workspace_rm "$@" ;;
    *)        echo "Usage: soma-agent workspace <list|upload|download|mkdir|rm> [args]"; exit 1 ;;
  esac
}

workspace_list() {
  local path="${1:-}"
  curl -s "${SOMA_API}/api/v1/files?path=$path" -H "$(auth_header)" | \
    python3 -c "
import sys, json
data = json.load(sys.stdin).get('files', [])
for f in data:
    icon = '📁' if f['type'] == 'dir' else '📄'
    print(f'{icon} {f[\"name\"]:<40} {f[\"size\"]:>10}')
print(f'\n{len(data)} items')
" 2>/dev/null || echo "❌ API unreachable"
}

workspace_upload() {
  local file="${1:-}" path="${2:-}"
  [ -z "$file" ] && { echo "Usage: soma-agent workspace upload <file> [path]"; exit 1; }
  [ ! -f "$file" ] && { echo "❌ File not found: $file"; exit 1; }

  local data
  data=$(base64 < "$file" | tr -d '\n')
  local name
  name=$(basename "$file")

  curl -s -X POST "${SOMA_API}/api/v1/files/upload" \
    -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"data\":\"$data\",\"path\":\"${path:-}\"}" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Uploaded:', d.get('path','?'))" 2>/dev/null || echo "❌ Upload failed"
}

workspace_download() {
  local path="${1:-}"
  [ -z "$path" ] && { echo "Usage: soma-agent workspace download <path>"; exit 1; }
  curl -s "${SOMA_API}/api/v1/files/content?path=$path" -H "$(auth_header)" > "$(basename "$path")"
  echo "✅ Downloaded: $(basename "$path")"
}

workspace_mkdir() {
  local path="${1:-}"
  [ -z "$path" ] && { echo "Usage: soma-agent workspace mkdir <path>"; exit 1; }
  curl -s -X POST "${SOMA_API}/api/v1/files/mkdir" -H "$(auth_header)" -H "Content-Type: application/json" -d "{\"path\":\"$path\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Created:', d.get('path','?'))" 2>/dev/null
}

workspace_rm() {
  local path="${1:-}"
  [ -z "$path" ] && { echo "Usage: soma-agent workspace rm <path>"; exit 1; }
  curl -s -X DELETE "${SOMA_API}/api/v1/files?path=$path" -H "$(auth_header)" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Deleted' if d.get('ok') else '❌ '+d.get('error','Failed'))" 2>/dev/null
}
