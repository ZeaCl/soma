defmodule Soma.MixProject do
  use Mix.Project

  def project do
    [
      app: :soma,
      version: "0.1.0",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      releases: [soma: [include_executables_for: [:unix], applications: [runtime_tools: :permanent]]],
      deps: deps()
    ]
  end

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
      {:corsica, "~> 2.1"}
    ]
  end
end
