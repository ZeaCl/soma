defmodule Soma.MixProject do
  use Mix.Project

  def project do
    [
      app: :soma,
      version: "0.2.0",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      elixirc_paths: elixirc_paths(Mix.env()),
      releases: [
        soma: [include_executables_for: [:unix], applications: [runtime_tools: :permanent]]
      ],
      aliases: aliases(),
      deps: deps(),
      test_coverage: [tool: ExCoveralls, summary: [threshold: 0]],
      aliases: aliases(),
      deps: deps()
    ]
  end

  def cli do
    [preferred_envs: [coveralls: :test, "coveralls.json": :test, "coveralls.html": :test]]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  def application do
    [
      extra_applications: [:logger],
      mod: {Soma.Application, []}
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7"},
      {:plug_cowboy, "~> 2.7"},
      {:jason, "~> 1.4"},
      {:joken, "~> 2.6"},
      {:req, "~> 0.5"},
      {:ecto_sql, "~> 3.12"},
      {:postgrex, "~> 0.19"},
      {:corsica, "~> 2.1"},
      {:excoveralls, "~> 0.18", only: :test},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:sobelow, "~> 0.13", only: [:dev, :test], runtime: false},
      {:prom_ex, "~> 1.11"},
      {:opentelemetry, "~> 1.4"},
      {:opentelemetry_api, "~> 1.3"},
      {:opentelemetry_ecto, "~> 1.2"},
      {:opentelemetry_exporter, "~> 1.7"}
    ]
  end

  defp aliases do
    [
      precommit: [
        "format --check-formatted",
        "compile --warnings-as-errors",
        "coveralls.json",
        "cmd ./doctor-soma.sh"
      ]
    ]
  end
end
