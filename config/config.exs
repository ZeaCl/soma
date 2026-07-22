import Config

config :soma, ecto_repos: [Soma.Repo]

config :soma, Soma.Repo,
  url:
    System.get_env(
      "DATABASE_URL",
      "postgresql://postgres:postgres_secure_password@localhost:5432/soma_prod"
    ),
  pool_size: 3

config :soma, SomaWeb.Endpoint,
  server: true,
  url: [host: "localhost"],
  render_errors: [formats: [json: SomaWeb.ErrorJSON]],
  pubsub_server: Soma.PubSub

config :soma, :thalamus,
  url: System.get_env("THALAMUS_URL", "http://thalamus:4000"),
  jwks_url: "http://thalamus:4000/.well-known/jwks.json"

config :soma, :agent_host, System.get_env("AGENT_HOST", "http://zea-agent:3001")

config :logger, level: :info

config :soma, SomaWeb.Endpoint,
  prom_ex: [
    plugins: [
      PromEx.Plugins.Ecto,
      PromEx.Plugins.Application,
      PromEx.Plugins.BEAM,
      Soma.AgentMetrics
    ],
    metrics_server: [port: 4021]
  ]

import_config "#{config_env()}.exs"
