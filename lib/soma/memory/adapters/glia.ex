defmodule Soma.Memory.Adapters.Glia do
  @moduledoc """
  Adapter de memoria para el runtime `Glia` (agente ReAct en Elixir) (#192 Fase 4).
  Mapea el Context Bundle al formato consumido por Glia (`Glia.Memory.LongTerm` o State)
  y/o persiste en `~/.glia/context/<conv_id>.json` si se especifica un directorio home.
  """
  @behaviour Soma.Memory.Adapter

  @impl true
  def inject_context(target, conv_id, bundle, opts \\ [])

  def inject_context(home, conv_id, bundle, opts) when is_binary(home) and is_binary(conv_id) do
    fs = Keyword.get(opts, :fs, Soma.FileSystem.Real)
    context_dir = Path.join([home, ".glia", "context"])

    with :ok <- fs.mkdir_p(context_dir) do
      target_file = Path.join(context_dir, "#{conv_id}.json")

      case fs.write(target_file, Jason.encode!(bundle, pretty: true)) do
        :ok ->
          glia_state = to_glia_format(conv_id, bundle)
          {:ok, %{file: target_file, glia_state: glia_state}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  def inject_context(target, conv_id, bundle, _opts) when is_map(target) and is_binary(conv_id) do
    glia_data = to_glia_format(conv_id, bundle)

    updated_state =
      if Map.has_key?(target, :messages) do
        %{target | messages: glia_data.messages}
      else
        Map.merge(target, glia_data)
      end

    {:ok, updated_state}
  end

  @doc """
  Convierte un Context Bundle al formato consumido por Glia.
  """
  @spec to_glia_format(binary(), map()) :: map()
  def to_glia_format(conv_id, bundle) do
    summary = bundle["summary"]

    messages =
      (bundle["messages"] || [])
      |> Enum.map(fn m ->
        %{
          role: m["role"],
          content: m["content"] || "",
          name: nil
        }
      end)

    # Si hay un summary acumulado, se antepone como mensaje de sistema o contexto inicial
    messages =
      if is_binary(summary) and String.trim(summary) != "" do
        [%{role: "system", content: "Context Summary:\n#{summary}", name: nil} | messages]
      else
        messages
      end

    %{
      conversation_id: conv_id,
      summary: summary,
      messages: messages,
      budget: bundle["budget"]
    }
  end
end
