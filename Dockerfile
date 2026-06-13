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
RUN apk add --no-cache ncurses-libs openssl libstdc++ bash nodejs npm git docker-cli docker-cli-compose
WORKDIR /app

# Soma Elixir app
COPY --from=build /app/_build/prod/rel/soma ./

# Pi sidecar (Node.js)
COPY server/package.json /app/server/package.json
WORKDIR /app/server
RUN npm install --omit=dev 2>/dev/null || true
COPY server/agent-rpc.ts /app/server/agent-rpc.ts
WORKDIR /app

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 4084 3002
ENV HOME=/app PORT=4084 MIX_ENV=prod SHELL=/bin/bash
ENV AGENT_RPC_PORT=3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --spider -q http://localhost:4084/health || exit 1
CMD ["/start.sh"]
