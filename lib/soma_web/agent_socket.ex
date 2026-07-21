defmodule SomaWeb.AgentSocket do
  @behaviour WebSock
  require Logger

  @impl true
  def init(state) do
    {:ok, Map.put(state, :agent_runner, nil)}
  end

  @impl true
  def handle_in({json_str, [opcode: :text]}, state) do
    case Jason.decode(json_str) do
      {:ok, %{"type" => "init", "uid" => agent_id, "cid" => conv_id, "token" => token}} ->
        handle_init(agent_id, conv_id, token, state)

      {:ok, %{"type" => "cancel"}} ->
        if state[:agent_runner] do
          Soma.AgentRunner.abort(state.agent_runner)
        end
        {:push, {:text, Jason.encode!(%{type: "cancelled"})}, state}

      {:ok, %{"type" => "prompt", "text" => text}} ->
        if state[:agent_runner] do
          spawn(fn ->
            Soma.Conversations.get_or_create(state.org_id, state.user_id, state.agent_id, "chat")
            Soma.Conversations.add_message(state.conv_id, %{
              role: "user",
              content: text
            })
          end)

          Soma.AgentRunner.send_prompt(state.agent_runner, text)
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
  def handle_info({:agent_event, %{"type" => "done", "final_text" => final_text, "final_thinking" => final_thinking, "final_tools" => final_tools}}, state) do
    spawn(fn ->
      tools = if Enum.empty?(final_tools), do: nil, else: final_tools
      
      Soma.Conversations.add_message(state.conv_id, %{
        role: "assistant",
        content: if(final_text != "", do: final_text, else: "(sin respuesta)"),
        thinking: if(final_thinking != "", do: final_thinking, else: nil),
        tools: tools
      })
    end)
    {:push, {:text, Jason.encode!(%{type: "done"})}, state}
  end

  @impl true
  def handle_info({:agent_event, event}, state) do
    {:push, {:text, Jason.encode!(event)}, state}
  end

  @impl true
  def handle_info(_info, state), do: {:ok, state}

  @impl true
  def terminate(_reason, state) do
    if state[:agent_runner] do
      Soma.AgentRunner.stop(state.agent_runner)
    end
    :ok
  end

  defp handle_init(agent_id, conv_id, token, state) do
    case SomaWeb.Plugs.JWTAuth.verify_token(token) do
      {:ok, claims, org_id} ->
        Logger.info("AgentSocket: Init agent=#{agent_id} org=#{org_id}")

        case Soma.AgentRunner.start_link(
               caller: self(),
               agent_id: agent_id,
               token: token
             ) do
          {:ok, pid} ->
            new_state =
              state
              |> Map.put(:agent_runner, pid)
              |> Map.put(:agent_id, agent_id)
              |> Map.put(:conv_id, conv_id)
              |> Map.put(:org_id, org_id)
              |> Map.put(:user_id, claims["sub"])

            {:ok, new_state}

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
