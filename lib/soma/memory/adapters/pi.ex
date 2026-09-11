defmodule Soma.Memory.Adapters.Pi do
  @moduledoc """
  Adapter de memoria para el runtime `pi` (#192 Fase 2/4).
  Escribe el Context Bundle en `~/.pi/agent/context/<conv_id>.json`.
  """
  @behaviour Soma.Memory.Adapter

  @impl true
  def inject_context(home, conv_id, bundle, opts \\ [])
      when is_binary(home) and is_binary(conv_id) do
    fs = Keyword.get(opts, :fs, Soma.FileSystem.Real)
    context_dir = Path.join([home, ".pi", "agent", "context"])

    with :ok <- fs.mkdir_p(context_dir) do
      target_file = Path.join(context_dir, "#{conv_id}.json")

      case fs.write(target_file, Jason.encode!(bundle, pretty: true)) do
        :ok -> {:ok, target_file}
        {:error, reason} -> {:error, reason}
      end
    end
  end
end
