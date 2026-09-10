defmodule Soma.Shell.Mock do
  @moduledoc "Mock para tests — permite predefinir respuestas de comandos shell."
  @behaviour Soma.Shell

  def start_link(responses \\ %{}) do
    Agent.start_link(fn -> %{responses: responses, port_commands: []} end, name: __MODULE__)
  end

  def set_responses(responses) do
    Agent.update(__MODULE__, fn state -> %{state | responses: responses} end)
  end

  def reset do
    Agent.update(__MODULE__, fn state -> %{state | responses: %{}, port_commands: []} end)
  end

  @doc "Devuelve la lista de datos enviados vía port_command, en orden."
  def port_commands do
    Agent.get(__MODULE__, fn state -> Enum.reverse(state.port_commands) end)
  end

  @impl true
  def cmd(executable, args, _opts) do
    key = {executable, args}
    responses = Agent.get(__MODULE__, & &1.responses)

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
  def port_command(port, data) do
    Agent.update(__MODULE__, fn state ->
      %{state | port_commands: [{port, data} | state.port_commands]}
    end)

    true
  end

  @impl true
  def port_close(_port), do: true
end
