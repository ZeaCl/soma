defmodule Soma.AgentRunner do
  @moduledoc """
  AgentRunner — ejecuta pi --mode rpc como subproceso aislado por agente.
  Cada agente corre como usuario Linux vía sudo -u soma-{id}.
  """
  use GenServer
  require Logger

  alias Soma.Sandbox
  alias Soma.AIProvider

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
    org_id = Keyword.fetch!(opts, :org_id)
    user_id = Keyword.fetch!(opts, :user_id)

    # Ensure sandbox exists before running the agent (idempotent)
    with {:ok, _uid, _home} <- Sandbox.create(agent_id, org_id) do
      username = Sandbox.username(agent_id)
      home = Sandbox.home_dir(agent_id)

      Soma.AgentMetrics.session_started(agent_id, "pi")

      secret_provider = Application.get_env(:soma, :secret_provider, Soma.SecretProvider.Thalamus)

      {env_vars, available_providers} =
        resolve_provider_envs(secret_provider, org_id, user_id)

      if available_providers == [] do
        error = %{
          "type" => "error",
          "code" => "no_ai_provider_configured",
          "message" => "Esta organización no tiene un proveedor IA configurado.",
          "fix" =>
            "zea thalamus secret create --name <nombre> --provider <provider> --value <api-key>",
          "providers" => AIProvider.supported() |> Enum.map(&AIProvider.to_query_param/1)
        }

        send(caller, {:agent_event, error})
        {:stop, :no_ai_provider_configured}
      else
        api_keys =
          [{"ZEA_TOKEN", token} | env_vars]
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

                  args =
                    if config["system_prompt"],
                      do: args ++ ["--system-prompt", config["system_prompt"]],
                      else: args

                  args =
                    if config["provider"],
                      do: args ++ ["--provider", config["provider"]],
                      else: args

                  args = if config["model"], do: args ++ ["--model", config["model"]], else: args
                  args

                _ ->
                  pi_args
              end

            _ ->
              pi_args
          end

        pi_cmd =
          "cd #{home} && #{api_keys} HOME=#{home} pi " <> Enum.map_join(pi_args, " ", &inspect/1)

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
           agent_id: agent_id,
           buffer: "",
           aborted: false,
           in_thinking: false,
           current_text: "",
           current_thinking: "",
           current_tools: [],
           prompt_start: nil,
           thinking_start: nil,
           abort_sigterm_timer: nil,
           abort_kill_timer: nil
         }}
      end
    else
      {:error, reason} ->
        Logger.error("AgentRunner: failed to create sandbox for #{agent_id}: #{reason}")

        send(
          caller,
          {:agent_event,
           %{
             "type" => "error",
             "code" => "sandbox_create_failed",
             "message" => "Failed to create sandbox user: #{reason}",
             "fix" => "zea soma sandbox create #{agent_id} --org #{org_id} --type agent"
           }}
        )

        {:stop, :sandbox_create_failed}
    end
  end

  @impl true
  def handle_cast({:prompt, text}, state) do
    Soma.AgentMetrics.request_sent(state.agent_id)
    msg = Jason.encode!(%{type: "prompt", message: text}) <> "\n"
    shell().port_command(state.port, msg)

    {:noreply,
     %{
       state
       | current_text: "",
         current_thinking: "",
         in_thinking: false,
         current_tools: [],
         prompt_start: System.monotonic_time(:millisecond)
     }}
  end

  @abort_sigterm_ms Application.compile_env(:soma, :abort_sigterm_ms, 3_000)
  @abort_kill_ms Application.compile_env(:soma, :abort_kill_ms, 5_000)

  @impl true
  def handle_cast(:abort, %{aborted: true} = state), do: {:noreply, state}

  @impl true
  def handle_cast(:abort, state) do
    # Enviar ambos comandos: abort (LLM) + abort_bash (subprocesos)
    shell().port_command(state.port, Jason.encode!(%{type: "abort"}) <> "\n")
    shell().port_command(state.port, Jason.encode!(%{type: "abort_bash"}) <> "\n")

    # Estrategia en 3 fases por si pi no responde (bloqueado en subproceso):
    # Fase 1 (0s): comandos stdin (abort + abort_bash)
    # Fase 2 (3s): SIGTERM al process group del Port
    # Fase 3 (5s): Kill forzoso del Port
    sigterm_timer = Process.send_after(self(), :abort_sigterm, @abort_sigterm_ms)
    kill_timer = Process.send_after(self(), :abort_timeout, @abort_kill_ms)

    {:noreply,
     %{state | aborted: true, abort_sigterm_timer: sigterm_timer, abort_kill_timer: kill_timer}}
  end

  @impl true
  def handle_cast(:stop, state) do
    cancel_timers(state)

    # Port may already be closed (e.g., by abort flow) — guard against double-close.
    # Port.info works on real ports but raises on mock refs, so rescue gracefully.
    try do
      case Port.info(state.port, :name) do
        {:name, _} -> shell().port_close(state.port)
        :undefined -> :ok
      end
    rescue
      _ -> :ok
    end

    {:stop, :normal, state}
  end

  @impl true
  def handle_info(:abort_sigterm, state) do
    Logger.warning("AgentRunner: abort SIGTERM phase — sending SIGTERM to pi process group")

    # Enviar SIGTERM al process group (PID negativo) para alcanzar
    # a todo el árbol: sudo → bash → pi → subprocesos.
    # Port.info funciona con ports reales; con mocks (tests) falla y hacemos skip.
    os_pid =
      try do
        case Port.info(state.port, :os_pid) do
          {:os_pid, pid} when is_integer(pid) and pid > 0 -> pid
          _ -> nil
        end
      rescue
        _ -> nil
      end

    if os_pid do
      try do
        System.cmd("kill", ["-TERM", "-#{os_pid}"])
      rescue
        _ -> Logger.warning("AgentRunner: kill command failed")
      end
    else
      Logger.warning("AgentRunner: could not get OS PID for port, skipping SIGTERM")
    end

    {:noreply, state}
  end

  @impl true
  def handle_info(:abort_timeout, state) do
    Logger.warning("AgentRunner: abort timeout — force-killing pi process")
    cancel_timers(state)
    shell().port_close(state.port)
    send(state.caller, {:agent_event, %{"type" => "aborted"}})
    {:stop, :abort_timeout, state}
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
  def handle_info({port, {:exit_status, status}}, %{port: port, aborted: true} = state) do
    Logger.info("AgentRunner port exited with status #{status} (aborted)")
    cancel_timers(state)
    {:stop, :normal, state}
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

  defp handle_jsonl(line, %{aborted: true} = state) do
    case Jason.decode(line) do
      {:ok, %{"type" => "agent_end"}} ->
        cancel_timers(state)
        send(state.caller, {:agent_event, %{"type" => "aborted"}})
        shell().port_close(state.port)
        state

      _ ->
        state
    end
  end

  defp handle_jsonl(line, state) do
    case Jason.decode(line) do
      {:ok, %{"type" => "response"}} ->
        state

      {:ok, %{"type" => "message_update", "assistantMessageEvent" => delta}} ->
        handle_delta(delta, state)

      {:ok, %{"type" => "tool_execution_start", "toolName" => name, "args" => args}} ->
        Soma.AgentMetrics.tool_called(state.agent_id, name)
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
        if state.prompt_start do
          duration = System.monotonic_time(:millisecond) - state.prompt_start
          Soma.AgentMetrics.response_duration(state.agent_id, "pi", duration)
        end

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
    %{state | in_thinking: true, thinking_start: System.monotonic_time(:millisecond)}
  end

  defp handle_delta(%{"type" => "thinking_delta", "delta" => delta}, state) do
    send(state.caller, {:agent_event, %{"type" => "thinking", "text" => delta}})
    %{state | current_thinking: state.current_thinking <> delta}
  end

  defp handle_delta(%{"type" => "thinking_end"}, state) do
    send(state.caller, {:agent_event, %{"type" => "thinking_end"}})

    if state.thinking_start do
      duration = System.monotonic_time(:millisecond) - state.thinking_start
      Soma.AgentMetrics.thinking_duration(state.agent_id, duration)
    end

    %{state | in_thinking: false, thinking_start: nil}
  end

  defp handle_delta(%{"type" => "error", "reason" => reason}, state) do
    Soma.AgentMetrics.error_occurred(state.agent_id, reason)

    send(
      state.caller,
      {:agent_event, %{"type" => "error", "message" => "Agent error: #{reason}"}}
    )

    state
  end

  defp handle_delta(_, state), do: state

  defp cancel_timers(state) do
    if state[:abort_sigterm_timer], do: Process.cancel_timer(state.abort_sigterm_timer)
    if state[:abort_kill_timer], do: Process.cancel_timer(state.abort_kill_timer)
  end

  defp resolve_provider_envs(provider_mod, org_id, user_id) do
    Enum.reduce(AIProvider.supported(), {[], []}, fn provider, {vars, available} ->
      query = AIProvider.to_query_param(provider)

      case provider_mod.resolve_secret(org_id, user_id, query) do
        {:ok, key} -> {[{AIProvider.to_env_var(provider), key} | vars], [query | available]}
        {:error, _} -> {vars, available}
      end
    end)
  end
end
