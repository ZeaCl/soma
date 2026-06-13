import Config

config :soma, workspace_root: "/tmp/soma-test-workspace"

config :soma, Soma.Repo,
  pool: Ecto.Adapters.SQL.Sandbox,
  url: "postgresql://postgres:postgres_secure_password@localhost:5432/soma_test",
  database: "soma_test",
  hostname: "localhost",
  pool_size: 2
