defmodule Soma.Shell.Mock do
  @moduledoc "Mock para tests — permite predefinir respuestas de comandos shell."
  @behaviour Soma.Shell

  def start_link(responses \\ %{}) do
    Agent.start_link(fn -> responses end, name: __MODULE__)
  end

  def set_responses(responses) do
    Agent.update(__MODULE__, fn _ -> responses end)
  end

  def reset do
    Agent.update(__MODULE__, fn _ -> %{} end)
  end

  @impl true
  def cmd(executable, args, _opts) do
    key = {executable, args}
    responses = Agent.get(__MODULE__, & &1)

    case Map.get(responses, key) || Map.get(responses, :default) do
      nil ->
        # Default: success
        {"", 0}

      {output, code} ->
        {output, code}

      fun when is_function(fun, 2) ->
        fun.(executable, args)
    end
  end

  @impl true
  def spawn_port(_port_spec, _options) do
    make_ref()
  end

  @impl true
  def port_command(_port, _data), do: true

  @impl true
  def port_close(_port), do: true
end
