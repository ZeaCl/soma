defmodule Soma.Memory do
  @moduledoc """
  Soma.Memory — Gestión autoritativa del contexto y reconstrucción desde Postgres (#192 Fase 2).

  La conversación y su memoria viven en Soma (Postgres). La sesión del runtime
  es un caché efímero y descartable.

  Este módulo ensambla el `Context Bundle` agnóstico que luego es consumido por los
  distintos runtimes (pi, opencode, claude-code, Glia).
  """

  alias Soma.Conversations
  alias Soma.Message

  @default_max_tokens 120_000
  @default_preserve_last_n 40
  @compaction_threshold_ratio 0.65

  @doc """
  Construye un Context Bundle completo para una conversación.

  Opciones:
    - `:system_prompt`: prompt del sistema del agente (string, default "")
    - `:max_tokens`: presupuesto máximo de tokens (default 120_000)
    - `:preserve_last_n`: cantidad máxima de mensajes recientes (default 40)
  """
  @spec build_context(binary(), keyword()) :: {:ok, map()} | {:error, term()}
  def build_context(conv_id, opts \\ []) when is_binary(conv_id) do
    case Ecto.UUID.cast(conv_id) do
      {:ok, uuid} ->
        max_tokens = Keyword.get(opts, :max_tokens, @default_max_tokens)
        preserve_last_n = Keyword.get(opts, :preserve_last_n, @default_preserve_last_n)
        system_prompt = Keyword.get(opts, :system_prompt, "")

        conv = Conversations.get_by_id(uuid)
        summary = if conv, do: conv.summary, else: nil

        # Traemos los mensajes recientes
        raw_messages = Conversations.list_messages(uuid, preserve_last_n)

        messages =
          Enum.map(raw_messages, fn %Message{} = msg ->
            map = %{
              "id" => msg.id,
              "role" => msg.role,
              "content" => msg.content || ""
            }

            map = if msg.thinking, do: Map.put(map, "thinking", msg.thinking), else: map
            if msg.tools, do: Map.put(map, "tools", msg.tools), else: map
          end)

        estimated_tokens = estimate_tokens(system_prompt, summary, messages)

        bundle = %{
          "conversationId" => uuid,
          "systemPrompt" => system_prompt,
          "summary" => summary,
          "messages" => messages,
          "budget" => %{
            "maxTokens" => max_tokens,
            "estimatedTokens" => estimated_tokens,
            "thresholdRatio" => @compaction_threshold_ratio
          }
        }

        {:ok, bundle}

      :error ->
        {:error, :invalid_conversation_id}
    end
  end

  @doc """
  Genera y persiste un resumen rodante para mensajes anteriores al umbral.
  Permite liberar los mensajes antiguos del context bundle sin perder contexto.
  """
  @spec compact_conversation(binary(), keyword()) :: {:ok, map()} | {:error, term()}
  def compact_conversation(conv_id, opts \\ []) when is_binary(conv_id) do
    case Ecto.UUID.cast(conv_id) do
      {:ok, uuid} ->
        conv = Conversations.get_by_id(uuid)

        if is_nil(conv) do
          {:error, :not_found}
        else
          # Listamos los mensajes del hilo
          all_messages = Conversations.list_messages(uuid, 200)

          # Si hay suficientes mensajes para compactar
          keep_recent = Keyword.get(opts, :keep_recent, 10)

          if length(all_messages) > keep_recent do
            split_at = length(all_messages) - keep_recent
            {to_summarize, _recent} = Enum.split(all_messages, split_at)
            last_to_summarize = List.last(to_summarize)

            new_summary =
              case Keyword.get(opts, :summary_text) do
                summary when is_binary(summary) and summary != "" ->
                  summary

                _ ->
                  build_extractive_summary(conv.summary, to_summarize)
              end

            Conversations.update_summary(uuid, new_summary, last_to_summarize.id)
            {:ok, %{summary: new_summary, covers_up_to: last_to_summarize.id}}
          else
            {:ok, :no_compaction_needed}
          end
        end

      :error ->
        {:error, :invalid_conversation_id}
    end
  end

  @doc """
  Escribe el Context Bundle en el directorio de contexto del agente (`~/.pi/agent/context/<conv_id>.json`).
  """
  @spec write_context_file(binary(), binary(), map(), module()) :: :ok | {:error, term()}
  def write_context_file(home, conv_id, bundle, fs \\ Soma.FileSystem.Real) do
    context_dir = Path.join([home, ".pi", "agent", "context"])

    with :ok <- fs.mkdir_p(context_dir) do
      target_file = Path.join(context_dir, "#{conv_id}.json")
      fs.write(target_file, Jason.encode!(bundle, pretty: true))
    end
  end

  # ── Estimación de tokens y summarization ──────────────────────────────

  defp estimate_tokens(system_prompt, summary, messages) do
    chars_prompt = String.length(system_prompt || "")
    chars_summary = String.length(summary || "")

    chars_msgs =
      Enum.reduce(messages, 0, fn msg, acc ->
        content_len = String.length(msg["content"] || "")
        thinking_len = String.length(msg["thinking"] || "")
        acc + content_len + thinking_len
      end)

    div(chars_prompt + chars_summary + chars_msgs, 4)
  end

  defp build_extractive_summary(existing_summary, messages_to_summarize) do
    new_points =
      messages_to_summarize
      |> Enum.map(fn msg ->
        role_label = if msg.role == "assistant", do: "Asistente", else: "Usuario"
        content_snippet = String.slice(msg.content || "", 0, 140)
        "- #{role_label}: #{content_snippet}"
      end)
      |> Enum.join("\n")

    if is_binary(existing_summary) and String.trim(existing_summary) != "" do
      "#{String.trim(existing_summary)}\n\n[Continuación compactada]:\n#{new_points}"
    else
      "[Resumen acumulado]:\n#{new_points}"
    end
  end
end
