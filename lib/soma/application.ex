defmodule Soma.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      Soma.Repo,
      {Phoenix.PubSub, name: Soma.PubSub},
      SomaWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Soma.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
