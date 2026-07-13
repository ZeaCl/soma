FROM hexpm/elixir:1.18.3-erlang-27.3.3-alpine-3.21.3 AS deps

RUN apk add --no-cache build-base git
WORKDIR /app
RUN mix local.hex --force && mix local.rebar --force
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod

FROM deps AS build
ENV MIX_ENV=prod
COPY config ./config
COPY lib ./lib
COPY priv ./priv
RUN mix deps.compile
RUN mix compile
RUN mix release

FROM alpine:3.21.3 AS runtime
RUN apk add --no-cache ncurses-libs openssl libstdc++ bash nodejs npm git docker-cli docker-cli-compose shadow sudo
WORKDIR /app

# ── Pi CLI (global, para subprocesos pi --mode rpc) ─────────────────
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent 2>/dev/null || true

# ── Default user files (para primer arranque con volumen persistente) ─
RUN cp /etc/passwd /etc/passwd.default && cp /etc/group /etc/group.default && cp /etc/shadow /etc/shadow.default 2>/dev/null || true

# ── Soma Elixir app ─────────────────────────────────────────────────
COPY --from=build /app/_build/prod/rel/soma ./

# ── Pi sidecar (Node.js): orquestador de subprocesos ────────────────
COPY server/package.json /app/server/package.json
WORKDIR /app/server
RUN npm install --omit=dev 2>/dev/null || true
COPY server/agent-rpc.ts /app/server/agent-rpc.ts
COPY server/agent-sandbox.ts /app/server/agent-sandbox.ts
COPY server/rpc-bridge.ts /app/server/rpc-bridge.ts
WORKDIR /app

# ── Scripts de sandbox (useradd/userdel para agentes y usuarios) ──
COPY scripts/soma-agent-useradd /usr/local/bin/soma-agent-useradd
COPY scripts/soma-agent-userdel /usr/local/bin/soma-agent-userdel
COPY scripts/soma-user-useradd /usr/local/bin/soma-user-useradd
COPY scripts/soma-user-userdel /usr/local/bin/soma-user-userdel
RUN chmod +x /usr/local/bin/soma-agent-useradd /usr/local/bin/soma-agent-userdel \
 && chmod +x /usr/local/bin/soma-user-useradd /usr/local/bin/soma-user-userdel

# ── Directorios base para el sandbox ────────────────────────────────
RUN mkdir -p /home /workspace/orgs /root/.agents/skills /app/.pi-agent-skills /app/.pi-agent-messages /app/.pi-agent-sessions

# ── Pi agent config (provider, model) ──────────────────────────────
RUN mkdir -p /app/.pi/agent && \
    echo '{"defaultProvider":"deepseek","defaultModel":"deepseek-v4-pro","defaultThinkingLevel":"high","theme":"dark"}' > /app/.pi/agent/settings.json && \
    echo '{}' > /app/.pi/agent/auth.json

# ── Skills para agentes IA ──────────────────────────────────────────
COPY skill/ /root/.agents/skills/

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 4084 3002
ENV HOME=/app PORT=4084 MIX_ENV=prod SHELL=/bin/bash
ENV AGENT_RPC_PORT=3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --spider -q http://localhost:4084/health || exit 1
CMD ["/start.sh"]
