ExUnit.start()

# Auto-migrate test DB before running tests
Ecto.Migrator.run(Soma.Repo, "priv/repo/migrations", :up, all: true)
