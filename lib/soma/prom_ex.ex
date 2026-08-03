defmodule Soma.PromEx do
  @moduledoc "PromEx metrics exporter for soma."
  use PromEx, otp_app: :soma

  @impl PromEx
  def plugins do
    [
      PromEx.Plugins.Ecto,
      PromEx.Plugins.Application,
      PromEx.Plugins.Beam,
      Soma.AgentMetrics
    ]
  end
end
