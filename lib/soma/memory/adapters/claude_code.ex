defmodule Soma.Memory.Adapters.ClaudeCode do
  @moduledoc """
  Adapter de memoria para el runtime `claude-code` (#192 Fase 4).
  Escribe el Context Bundle en `~/.claude/context/<conv_id>.json`
  e inyecta el bloque de contexto en `CLAUDE.md`.
  """
  @behaviour Soma.Memory.Adapter

  @impl true
  def inject_context(home, conv_id, bundle, opts \\ [])
      when is_binary(home) and is_binary(conv_id) do
    fs = Keyword.get(opts, :fs, Soma.FileSystem.Real)
    context_dir = Path.join([home, ".claude", "context"])

    with :ok <- fs.mkdir_p(context_dir),
         target_file <- Path.join(context_dir, "#{conv_id}.json"),
         :ok <- fs.write(target_file, Jason.encode!(bundle, pretty: true)) do
      update_claude_md = Keyword.get(opts, :update_claude_md, true)

      if update_claude_md do
        maybe_update_claude_md(home, conv_id, bundle, fs)
      end

      {:ok, target_file}
    end
  end

  defp maybe_update_claude_md(home, conv_id, bundle, fs) do
    claude_path = Path.join(home, "CLAUDE.md")

    existing_content =
      case fs.read(claude_path) do
        {:ok, content} -> content
        _ -> ""
      end

    context_block = build_context_block(conv_id, bundle)
    new_content = inject_or_replace_block(existing_content, conv_id, context_block)
    fs.write(claude_path, new_content)
  end

  defp build_context_block(conv_id, bundle) do
    summary_text = bundle["summary"] || "(Sin resumen acumulado)"

    """
    <!-- SOMA_CONTEXT_START: #{conv_id} -->
    ## Active Conversation Memory (#{conv_id})
    ### Summary:
    #{summary_text}
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
