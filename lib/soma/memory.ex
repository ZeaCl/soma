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

        raw_messages = Conversations.list_messages(uuid, preserve_last_n)

        messages =
          Enum.map(raw_messages, fn %Message{} = msg ->
            map = %{
              "role" => msg.role,
              "content" => msg.content || ""
            }

            map = if msg.thinking, do: Map.put(map, "thinking", msg.thinking), else: map
            if msg.tools, do: Map.put(map, "tools", msg.tools), else: map
          end)

        estimated_tokens = estimate_tokens(system_prompt, messages)

        bundle = %{
          "conversationId" => uuid,
          "systemPrompt" => system_prompt,
          "summary" => nil,
          "messages" => messages,
          "budget" => %{
            "maxTokens" => max_tokens,
            "estimatedTokens" => estimated_tokens
          }
        }

        {:ok, bundle}

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

  # ── Estimación de tokens básica ───────────────────────────────────────

  defp estimate_tokens(system_prompt, messages) do
    chars_prompt = String.length(system_prompt || "")

    chars_msgs =
      Enum.reduce(messages, 0, fn msg, acc ->
        content_len = String.length(msg["content"] || "")
        thinking_len = String.length(msg["thinking"] || "")
        acc + content_len + thinking_len
      end)

    div(chars_prompt + chars_msgs, 4)
  end
end
