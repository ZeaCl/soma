defmodule SomaWeb.AgentSocket do
  @moduledoc "WebSocket handler para chat de agentes."
  @behaviour WebSock
  require Logger

  alias Soma.AgentRunner
  alias Soma.Conversations
  alias SomaWeb.Plugs.JWTAuth

  # Delegate to JWTAuth for canonical normalization
  defp normalize_user_id(id), do: JWTAuth.normalize_user_id(id)

  @impl true
  def init(state) do
    Process.flag(:trap_exit, true)
    {:ok, Map.put(state, :agent_runner, nil)}
  end

  @impl true
  def handle_in({json_str, [opcode: :text]}, state) do
    case Jason.decode(json_str) do
      {:ok, %{"type" => "init", "uid" => agent_id, "cid" => conv_id, "token" => token}} ->
        handle_init(agent_id, conv_id, token, state)

      {:ok, %{"type" => "cancel"}} ->
        if state[:agent_runner] do
          AgentRunner.abort(state.agent_runner)
        end

        {:push, {:text, Jason.encode!(%{type: "cancelled"})}, state}

      {:ok, %{"type" => "prompt", "text" => text}} ->
        if state[:agent_runner] do
          spawn(fn ->
            case Conversations.add_message(state.conv_id, %{
              role: "user",
              content: text
            }) do
              {:ok, _} -> :ok
              {:error, reason} -> Logger.error("AgentSocket: failed to save user message: #{inspect(reason)}")
            end
          end)

          AgentRunner.send_prompt(state.agent_runner, text)
          {:ok, state}
        else
          {:push, {:text, Jason.encode!(%{type: "error", message: "Not initialized"})}, state}
        end

      _ ->
        {:push, {:text, Jason.encode!(%{type: "error", message: "Unknown command"})}, state}
    end
  end

  @impl true
  def handle_in(_frame, state), do: {:ok, state}

  @impl true
  def handle_info(
        {:agent_event,
         %{
           "type" => "done",
           "final_text" => final_text,
           "final_thinking" => final_thinking,
           "final_tools" => final_tools
         }},
        state
      ) do
    spawn(fn ->
      tools = if Enum.empty?(final_tools), do: nil, else: final_tools

      case Conversations.add_message(state.conv_id, %{
        role: "assistant",
        content: if(final_text != "", do: final_text, else: "(sin respuesta)"),
        thinking: if(final_thinking != "", do: final_thinking, else: nil),
        tools: tools
      }) do
        {:ok, _} -> :ok
        {:error, reason} -> Logger.error("AgentSocket: failed to save assistant message: #{inspect(reason)}")
      end
    end)

    {:push, {:text, Jason.encode!(%{type: "done"})}, state}
  end

  @impl true
  def handle_info({:agent_event, event}, state) do
    {:push, {:text, Jason.encode!(event)}, state}
  end

  @impl true
  def handle_info({:EXIT, _pid, _reason}, state) do
    {:ok, state}
  end

  @impl true
  def handle_info(_info, state), do: {:ok, state}

  @impl true
  def terminate(_reason, state) do
    if state[:agent_runner] do
      AgentRunner.stop(state.agent_runner)
    end

    :ok
  end

  defp handle_init(agent_id, _conv_id, token, state) do
    case JWTAuth.verify_token(token) do
      {:ok, claims, org_id} ->
        Logger.info("AgentSocket: Init agent=#{agent_id} org=#{org_id}")

        user_id = normalize_user_id(claims["sub"])

        # Resolver la conversación real (UUID) — el cid del cliente puede ser
        # un string arbitrario (ej. "cli-{timestamp}"), no un UUID válido para Ecto.
        conversation = Conversations.get_or_create(org_id, user_id, agent_id, "chat")

        case AgentRunner.start_link(
               caller: self(),
               agent_id: agent_id,
               token: token,
               org_id: org_id,
               user_id: user_id
             ) do
          {:ok, pid} ->
            new_state =
              state
              |> Map.put(:agent_runner, pid)
              |> Map.put(:agent_id, agent_id)
              |> Map.put(:conv_id, conversation.id)
              |> Map.put(:org_id, org_id)
              |> Map.put(:user_id, user_id)

            {:ok, new_state}

          {:error, :no_ai_provider_configured} ->
            # AgentRunner already sent the structured error via {:agent_event, ...}
            # before stopping. Don't send a duplicate.
            {:ok, state}

          {:error, reason} ->
            msg = %{type: "error", message: "Failed to start agent: #{inspect(reason)}"}
            {:push, {:text, Jason.encode!(msg)}, state}
        end

      {:error, reason} ->
        msg = %{type: "error", message: "Unauthorized: #{inspect(reason)}"}
        {:push, {:text, Jason.encode!(msg)}, state}
    end
  end


end
