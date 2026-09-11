defmodule Soma.Memory.Adapters.Opencode do
  @moduledoc """
  Adapter de memoria para el runtime `opencode` (#192 Fase 4).
  Escribe el Context Bundle en `~/.opencode/context/<conv_id>.json`
  y actualiza la sección de memoria en `AGENTS.md` si existe o se solicita.
  """
  @behaviour Soma.Memory.Adapter

  @impl true
  def inject_context(home, conv_id, bundle, opts \\ [])
      when is_binary(home) and is_binary(conv_id) do
    fs = Keyword.get(opts, :fs, Soma.FileSystem.Real)
    context_dir = Path.join([home, ".opencode", "context"])

    with :ok <- fs.mkdir_p(context_dir),
         target_file <- Path.join(context_dir, "#{conv_id}.json"),
         :ok <- fs.write(target_file, Jason.encode!(bundle, pretty: true)) do
      update_agents_md = Keyword.get(opts, :update_agents_md, true)

      if update_agents_md do
        maybe_update_agents_md(home, conv_id, bundle, fs)
      end

      {:ok, target_file}
    end
  end

  defp maybe_update_agents_md(home, conv_id, bundle, fs) do
    agents_path = Path.join(home, "AGENTS.md")

    existing_content =
      case fs.read(agents_path) do
        {:ok, content} -> content
        _ -> ""
      end

    context_block = build_context_block(conv_id, bundle)
    new_content = inject_or_replace_block(existing_content, conv_id, context_block)
    fs.write(agents_path, new_content)
  end

  defp build_context_block(conv_id, bundle) do
    summary_text = bundle["summary"] || "(Sin resumen acumulado)"

    recent_msgs =
      (bundle["messages"] || [])
      |> Enum.take(-5)
      |> Enum.map(fn m -> "- **#{m["role"]}**: #{String.slice(m["content"] || "", 0, 120)}" end)
      |> Enum.join("\n")

    """
    <!-- SOMA_CONTEXT_START: #{conv_id} -->
    ## Conversación Activa: #{conv_id}
    ### Memoria / Resumen:
    #{summary_text}

    ### Mensajes Recientes:
    #{if recent_msgs == "", do: "(Sin mensajes recientes)", else: recent_msgs}
    <!-- SOMA_CONTEXT_END -->
    """
  end

  defp inject_or_replace_block(content, conv_id, block) do
    regex =
      ~r/<!-- SOMA_CONTEXT_START: #{Regex.escape(conv_id)} -->.*?<!-- SOMA_CONTEXT_END -->\n?/s

    if Regex.match?(regex, content) do
      Regex.replace(regex, content, block)
    else
      if String.trim(content) == "" do
        block
      else
        "#{String.trim_trailing(content)}\n\n#{block}"
      end
    end
  end
end
