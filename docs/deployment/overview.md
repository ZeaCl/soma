# Deployment

## Docker (Recommended)

```bash
docker build -t soma .
docker run -d \
  -p 4084:4084 \
  -e DATABASE_URL="ecto://postgres:postgres@host.docker.internal:5432/soma_prod" \
  -e SECRET_KEY_BASE="$(mix phx.gen.secret)" \
  -e THALAMUS_URL="http://thalamus:4000" \
  -e DEEPSEEK_API_KEY="sk-..." \
  -v soma-homes:/home \
  --name soma \
  soma
```

## Docker Compose

```yaml
services:
  soma:
    build: .
    ports: ["4084:4084"]
    environment:
      DATABASE_URL: "ecto://soma_user:${SOMA_DB_PASSWORD}@postgres:5432/soma_prod"
      SECRET_KEY_BASE: ${SECRET_KEY_BASE_SOMA}
      MIX_ENV: prod
      PHX_HOST: soma.zea.localhost
      THALAMUS_URL: "http://thalamus:4000"
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
    volumes: [soma_homes:/home]
    depends_on:
      postgres:
        condition: service_healthy
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `SECRET_KEY_BASE` | ✅ | — | Phoenix secret (64+ bytes) |
| `THALAMUS_URL` | ✅ | — | Auth service URL |
| `PHX_HOST` | — | `soma.zea.localhost` | Host header |
| `PORT` | — | `4084` | HTTP port |
| `DEEPSEEK_API_KEY` | — | — | DeepSeek API key |
| `ANTHROPIC_API_KEY` | — | — | Anthropic API key |
| `OPENAI_API_KEY` | — | — | OpenAI API key |
| `SKILLS_DIR` | — | `/root/.agents/skills` | Builtin skills path |
| `POOL_SIZE` | — | `3` | DB pool size |

## Health Check

```bash
curl http://localhost:4084/health
# {"status":"ok","service":"soma"}
```

## Migrations

Migrations run automatically on start via `start.sh` bootstrap. For manual migration:

```bash
docker exec soma bin/soma eval "Soma.Release.migrate"
```

## Reverse Proxy (Caddy)

```caddy
soma.zea.cl {
    @options method OPTIONS
    handle @options {
        header Access-Control-Allow-Origin "https://sudlich.zea.cl"
        respond 204
    }
    reverse_proxy soma:4084
}
```

## CI/CD

See `.github/workflows/publish-docker.yml` — builds and pushes to GHCR on main push.
