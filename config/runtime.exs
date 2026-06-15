import Config

config :soma, ecto_repos: [Soma.Repo]

config :soma, Soma.Repo,
  url: System.get_env("DATABASE_URL", "postgresql://postgres:postgres_secure_password@postgres:5432/soma_prod"),
  pool_size: String.to_integer(System.get_env("POOL_SIZE", "3"))

config :soma, SomaWeb.Endpoint,
  server: true,
  url: [host: System.get_env("PHX_HOST", "soma.zea.localhost"), port: 80],
  http: [port: String.to_integer(System.get_env("PORT", "4084"))],
  secret_key_base: System.get_env("SECRET_KEY_BASE", "dev-secret-CHANGE-ME-in-production-64bytes-minimum")

config :soma, :thalamus,
  url: System.get_env("THALAMUS_URL", "http://thalamus:4000"),
  jwks_url: System.get_env("THALAMUS_URL", "http://thalamus:4000") <> "/.well-known/jwks.json"

config :soma, :agent_host, System.get_env("AGENT_HOST", "http://zea-agent:3001")
