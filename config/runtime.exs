import Config

config :soma, ecto_repos: [Soma.Repo]

config :soma, Soma.Repo,
  url:
    System.get_env(
      "DATABASE_URL",
      "postgresql://postgres:postgres_secure_password@postgres:5432/soma_prod"
    ),
  pool_size: String.to_integer(System.get_env("POOL_SIZE", "3"))

config :soma, SomaWeb.Endpoint,
  server: true,
  url: [host: System.get_env("PHX_HOST", "soma.zea.localhost"), port: 80],
  http: [port: String.to_integer(System.get_env("PORT", "4084"))],
  secret_key_base:
    System.get_env("SECRET_KEY_BASE", "dev-secret-CHANGE-ME-in-production-64bytes-minimum")

config :soma, :thalamus,
  url: System.get_env("THALAMUS_URL", "http://thalamus:4000"),
  jwks_url: System.get_env("THALAMUS_URL", "http://thalamus:4000") <> "/.well-known/jwks.json"

config :soma, :agent_host, System.get_env("AGENT_HOST", "http://zea-agent:3001")

# ── Redis (AgentEvents pub/sub + AgentState cache) ───────────────
redis_url = System.get_env("REDIS_URL")

if redis_url do
  uri = URI.parse(redis_url)

  password =
    case uri.userinfo do
      # "username:password"
      info when is_binary(info) and info != "" ->
        case String.split(info, ":", parts: 2) do
          [_, pass] -> pass
          [_] -> nil
        end

      _ ->
        System.get_env("REDIS_PASSWORD")
    end

  config :soma, :redis,
    host: uri.host || "redis",
    port: uri.port || 6379,
    password: password,
    database: 0
else
  config :soma, :redis,
    host: System.get_env("REDIS_HOST", "redis"),
    port: String.to_integer(System.get_env("REDIS_PORT", "6379")),
    password: System.get_env("REDIS_PASSWORD"),
    database: 0
end

config :soma, :workspace_root, System.get_env("WORKSPACE_ROOT", "/home/orgs")
config :soma, :org_workspace_root, System.get_env("WORKSPACE_ROOT", "/home/orgs")

# ── Secret Provider ───────────────────────────────────────────────────
config :soma, :secret_provider, Soma.SecretProvider.Thalamus

# JSON log format for Loki/Promtail ingestion
config :logger, :console,
  format: {Soma.LogFormatter, :format},
  metadata: [:agent_id, :request_id, :org_id]

# ── OpenTelemetry ──────────────────────────────────────────────────────
config :opentelemetry,
  span_processor: :batch,
  traces_exporter: :otlp

config :opentelemetry_exporter,
  otlp_endpoint: System.get_env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4318"),
  otlp_protocol: :http_protobuf,
  otlp_compression: :gzip
