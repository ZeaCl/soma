defmodule Soma.Application do
  @moduledoc "Application entry point — inicia el supervisor con Endpoint, PromEx y OTel."
  use Application

  @impl true
  def start(_type, _args) do
    # OpenTelemetry Ecto tracer
    :ok = OpentelemetryEcto.setup([:soma, :repo])

    children = [
      Soma.Repo,
      {Phoenix.PubSub, name: Soma.PubSub},
      SomaWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Soma.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
