defmodule Soma.PromEx do
  @moduledoc "PromEx metrics exporter for soma."
  use PromEx, otp_app: :soma

  @impl PromEx
  def plugins do
    [
      PromEx.Plugins.Ecto,
      PromEx.Plugins.Application,
      PromEx.Plugins.BEAM,
      Soma.AgentMetrics
    ]
  end
end
