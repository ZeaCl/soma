defmodule Soma.AgentRunner do
  @moduledoc """
  AgentRunner — ejecuta pi --mode rpc como subproceso aislado por agente.
  Cada agente corre como usuario Linux vía sudo -u soma-{id}.
  """
  use GenServer
  require Logger

  alias Soma.Sandbox

  defp shell, do: Application.get_env(:soma, :shell, Soma.Shell.Real)
  defp fs, do: Application.get_env(:soma, :file_system, Soma.FileSystem.Real)

  @doc """
  Starts the AgentRunner for a specific agent and conversation.
  `caller` is the pid of the WebSocket handler to receive messages.
  """
  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  def send_prompt(pid, text) do
    GenServer.cast(pid, {:prompt, text})
  end

  def abort(pid) do
    GenServer.cast(pid, :abort)
  end

  def stop(pid) do
    GenServer.cast(pid, :stop)
  end

  @impl true
  def init(opts) do
    caller = Keyword.fetch!(opts, :caller)
    agent_id = Keyword.fetch!(opts, :agent_id)
    token = Keyword.fetch!(opts, :token)

    username = Sandbox.username(agent_id)
    home = Sandbox.home_dir(agent_id)

    api_keys =
      [
        {"ZEA_TOKEN", token},
        {"DEEPSEEK_API_KEY", System.get_env("DEEPSEEK_API_KEY")},
        {"ANTHROPIC_API_KEY", System.get_env("ANTHROPIC_API_KEY")},
        {"OPENAI_API_KEY", System.get_env("OPENAI_API_KEY")}
      ]
      |> Enum.filter(fn {_, v} -> v != nil and v != "" end)
      |> Enum.map(fn {k, v} -> "#{k}=#{v}" end)
      |> Enum.join(" ")

    # Read local config if exists
    config_path = Path.join([home, ".pi", "agent", "config.json"])
    pi_args = ["--mode", "rpc", "--session-dir", "#{home}/.pi-sessions"]

    pi_args =
      case fs().read(config_path) do
        {:ok, content} ->
          case Jason.decode(content) do
            {:ok, config} ->
              args = pi_args
              args = if config["system_prompt"], do: args ++ ["--system-prompt", config["system_prompt"]], else: args
              args = if config["provider"], do: args ++ ["--provider", config["provider"]], else: args
              args = if config["model"], do: args ++ ["--model", config["model"]], else: args
              args
            _ -> pi_args
          end
        _ -> pi_args
      end

    pi_cmd = "#{api_keys} HOME=#{home} pi " <> Enum.map_join(pi_args, " ", &inspect/1)
    args = ["-u", username, "bash", "-c", pi_cmd]

    Logger.info("AgentRunner: sudo #{Enum.join(args, " ")}")

    port =
      shell().spawn_port(
        {:spawn_executable, System.find_executable("sudo")},
        [:binary, :stream, :use_stdio, :exit_status, args: args]
      )

    send(caller, {:agent_event, %{"type" => "ready"}})

    {:ok,
     %{
       port: port,
       caller: caller,
       buffer: "",
       in_thinking: false,
       current_text: "",
       current_thinking: "",
       current_tools: []
     }}
  end

  @impl true
  def handle_cast({:prompt, text}, state) do
    msg = Jason.encode!(%{type: "prompt", message: text}) <> "\n"
    shell().port_command(state.port, msg)

    {:noreply,
     %{state | current_text: "", current_thinking: "", in_thinking: false, current_tools: []}}
  end

  @impl true
  def handle_cast(:abort, state) do
    msg = Jason.encode!(%{type: "abort"}) <> "\n"
    shell().port_command(state.port, msg)
    {:noreply, state}
  end

  @impl true
  def handle_cast(:stop, state) do
    shell().port_close(state.port)
    {:stop, :normal, state}
  end

  @impl true
  def handle_info({port, {:data, data}}, %{port: port} = state) do
    new_buffer = state.buffer <> data
    {lines, remaining} = extract_lines(new_buffer, [])

    new_state =
      Enum.reduce(lines, %{state | buffer: remaining}, fn line, acc ->
        handle_jsonl(line, acc)
      end)

    {:noreply, new_state}
  end

  @impl true
  def handle_info({port, {:exit_status, status}}, %{port: port} = state) do
    Logger.info("AgentRunner port exited with status #{status}")

    send(
      state.caller,
      {:agent_event,
       %{"type" => "error", "message" => "Agent process exited with code #{status}"}}
    )

    {:stop, :normal, state}
  end

  defp extract_lines(buffer, acc) do
    case String.split(buffer, "\n", parts: 2) do
      [line, rest] -> extract_lines(rest, [String.trim_trailing(line, "\r") | acc])
      [rest] -> {Enum.reverse(acc), rest}
    end
  end

  defp handle_jsonl("", state), do: state

  defp handle_jsonl(line, state) do
    case Jason.decode(line) do
      {:ok, %{"type" => "response"}} ->
        state

      {:ok, %{"type" => "message_update", "assistantMessageEvent" => delta}} ->
        handle_delta(delta, state)

      {:ok, %{"type" => "tool_execution_start", "toolName" => name, "args" => args}} ->
        send(state.caller, {:agent_event, %{"type" => "tool", "name" => name, "input" => args}})
        %{state | current_tools: state.current_tools ++ [%{name: name, input: args}]}

      {:ok, %{"type" => "tool_execution_end", "result" => %{"content" => [%{"text" => text}]}}} ->
        send(state.caller, {:agent_event, %{"type" => "tool_result", "content" => text}})
        # Update the last tool with the result
        new_tools =
          case Enum.reverse(state.current_tools) do
            [last | rest] -> Enum.reverse([Map.put(last, :result, text) | rest])
            [] -> []
          end

        %{state | current_tools: new_tools}

      {:ok, %{"type" => "agent_end", "willRetry" => false}} ->
        send(
          state.caller,
          {:agent_event,
           %{
             "type" => "done",
             "final_text" => state.current_text,
             "final_thinking" => state.current_thinking,
             "final_tools" => state.current_tools
           }}
        )

        state

      {:ok, %{"type" => "extension_ui_request", "method" => method, "id" => id}}
      when method in ["select", "confirm", "input", "editor"] ->
        resp = %{type: "extension_ui_response", id: id, cancelled: true}
        resp = if method == "confirm", do: Map.put(resp, :confirmed, false), else: resp
        shell().port_command(state.port, Jason.encode!(resp) <> "\n")
        state

      _ ->
        state
    end
  end

  defp handle_delta(%{"type" => "text_delta", "delta" => delta}, state) do
    send(state.caller, {:agent_event, %{"type" => "delta", "text" => delta}})
    %{state | current_text: state.current_text <> delta}
  end

  defp handle_delta(%{"type" => "thinking_start"}, state) do
    send(state.caller, {:agent_event, %{"type" => "thinking_start"}})
    %{state | in_thinking: true}
  end

  defp handle_delta(%{"type" => "thinking_delta", "delta" => delta}, state) do
    send(state.caller, {:agent_event, %{"type" => "thinking", "text" => delta}})
    %{state | current_thinking: state.current_thinking <> delta}
  end

  defp handle_delta(%{"type" => "thinking_end"}, state) do
    send(state.caller, {:agent_event, %{"type" => "thinking_end"}})
    %{state | in_thinking: false}
  end

  defp handle_delta(%{"type" => "error", "reason" => reason}, state) do
    send(
      state.caller,
      {:agent_event, %{"type" => "error", "message" => "Agent error: #{reason}"}}
    )

    state
  end

  defp handle_delta(_, state), do: state
end
