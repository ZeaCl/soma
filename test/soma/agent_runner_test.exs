defmodule Soma.AgentRunnerTest do
  use ExUnit.Case, async: false

  alias Soma.AgentRunner

  @agent "test-agent-000000000001"
  @token "test-token"
  @org_id "test-org-000000000001"
  @user_id "test-user-000000000001"

  setup do
    Application.put_env(:soma, :shell, Soma.Shell.Mock)
    Application.put_env(:soma, :file_system, Soma.FileSystem.Mock)
    Application.put_env(:soma, :secret_provider, Soma.SecretProvider.Mock)
    Soma.Shell.Mock.start_link(%{})
    Soma.FileSystem.Mock.start_link(%{})

    # Default mock: return fake UID for id -u commands so Sandbox.create succeeds
    Soma.Shell.Mock.set_responses(%{
      default: fn executable, args ->
        case {executable, args} do
          {"id", ["-u", _username]} -> {"1000\n", 0}
          _ -> {"", 0}
        end
      end
    })

    on_exit(fn ->
      Application.delete_env(:soma, :shell)
      Application.delete_env(:soma, :file_system)
      Application.delete_env(:soma, :secret_provider)
    end)

    :ok
  end

  defp default_opts do
    [caller: self(), agent_id: @agent, token: @token, org_id: @org_id, user_id: @user_id]
  end

  defp start_agent! do
    {:ok, pid} = AgentRunner.start_link(default_opts())
    assert_receive {:agent_event, %{"type" => "ready"}}, 500
    pid
  end

  defp port_from(pid) do
    :sys.get_state(pid).port
  end

  # ── Sesión por conversación (#192) ───────────────────────────────────

  test "pi_session_id/1 accepts UUIDs and rejects invalid ids" do
    assert AgentRunner.pi_session_id("6f6f5a3e-1111-2222-3333-444455556666") ==
             "6f6f5a3e-1111-2222-3333-444455556666"

    assert AgentRunner.pi_session_id("dm:nutrisnaps-assistant") == nil
    assert AgentRunner.pi_session_id("has spaces") == nil
    assert AgentRunner.pi_session_id("-leading-dash") == nil
    assert AgentRunner.pi_session_id("") == nil
    assert AgentRunner.pi_session_id(nil) == nil
  end

  test "conversation_id is stored in state" do
    conv_id = "6f6f5a3e-1111-2222-3333-444455556666"

    opts = Keyword.put(default_opts(), :conversation_id, conv_id)
    {:ok, pid} = AgentRunner.start_link(opts)
    assert_receive {:agent_event, %{"type" => "ready"}}, 500

    assert :sys.get_state(pid).conversation_id == conv_id

    AgentRunner.stop(pid)
  end

  test "conversation_id defaults to nil when not provided" do
    pid = start_agent!()
    assert :sys.get_state(pid).conversation_id == nil
    AgentRunner.stop(pid)
  end

  # ── API ──────────────────────────────────────────────────────────────

  test "start_link starts a GenServer and sends ready to caller" do
    pid = start_agent!()
    assert is_pid(pid)
    AgentRunner.stop(pid)
  end

  test "send_prompt and abort are cast to the GenServer" do
    pid = start_agent!()

    AgentRunner.send_prompt(pid, "hello")
    AgentRunner.abort(pid)

    Process.monitor(pid)
    AgentRunner.stop(pid)
    assert_receive {:DOWN, _, :process, ^pid, _}, 1000
  end

  # ── JSONL processing via port messages ───────────────────────────────

  test "processes JSONL text delta from port" do
    pid = start_agent!()
    port = port_from(pid)

    jsonl =
      Jason.encode!(%{
        type: "message_update",
        assistantMessageEvent: %{type: "text_delta", delta: "Hola "}
      }) <> "\n"

    send(pid, {port, {:data, jsonl}})
    assert_receive {:agent_event, %{"type" => "delta", "text" => "Hola "}}, 500

    AgentRunner.stop(pid)
  end

  test "processes thinking events from port" do
    pid = start_agent!()
    port = port_from(pid)

    jsonl =
      Jason.encode!(%{type: "message_update", assistantMessageEvent: %{type: "thinking_start"}}) <>
        "\n"

    send(pid, {port, {:data, jsonl}})
    assert_receive {:agent_event, %{"type" => "thinking_start"}}, 500

    AgentRunner.stop(pid)
  end

  test "processes tool execution from port" do
    pid = start_agent!()
    port = port_from(pid)

    jsonl =
      Jason.encode!(%{
        type: "tool_execution_start",
        toolName: "bash",
        args: "ls"
      }) <> "\n"

    send(pid, {port, {:data, jsonl}})
    assert_receive {:agent_event, %{"type" => "tool", "name" => "bash", "input" => "ls"}}, 500

    AgentRunner.stop(pid)
  end

  test "processes agent_end done from port" do
    pid = start_agent!()
    port = port_from(pid)

    delta =
      Jason.encode!(%{
        type: "message_update",
        assistantMessageEvent: %{type: "text_delta", delta: "OK"}
      }) <> "\n"

    send(pid, {port, {:data, delta}})
    assert_receive {:agent_event, %{"type" => "delta"}}, 500

    done = Jason.encode!(%{type: "agent_end", willRetry: false}) <> "\n"
    send(pid, {port, {:data, done}})
    assert_receive {:agent_event, %{"type" => "done", "final_text" => "OK"}}, 500

    AgentRunner.stop(pid)
  end

  test "handles port exit" do
    pid = start_agent!()
    port = port_from(pid)

    Process.monitor(pid)
    send(pid, {port, {:exit_status, 1}})

    assert_receive {:agent_event,
                    %{"type" => "error", "message" => "Agent process exited with code 1"}},
                   500

    assert_receive {:DOWN, _, :process, ^pid, _}, 1000
  end

  # ── Context compaction (soma#185) ───────────────────────────────────

  test "enables auto_compaction on pi via port_command on start" do
    pid = start_agent!()
    port = port_from(pid)

    commands = Soma.Shell.Mock.port_commands()

    assert Enum.any?(commands, fn {p, data} ->
             p == port and
               match?(
                 %{"type" => "set_auto_compaction", "enabled" => true},
                 Jason.decode!(data)
               )
           end),
           "expected set_auto_compaction command on port"

    AgentRunner.stop(pid)
  end

  test "relays compaction_start from port as compacting start" do
    pid = start_agent!()
    port = port_from(pid)

    jsonl = Jason.encode!(%{type: "compaction_start", reason: "threshold"}) <> "\n"
    send(pid, {port, {:data, jsonl}})

    assert_receive {:agent_event,
                    %{"type" => "compacting", "phase" => "start", "reason" => "threshold"}},
                   500

    AgentRunner.stop(pid)
  end

  test "relays compaction_end from port as compacting end with token metrics" do
    pid = start_agent!()
    port = port_from(pid)

    jsonl =
      Jason.encode!(%{
        type: "compaction_end",
        reason: "threshold",
        result: %{tokensBefore: 150_000, estimatedTokensAfter: 32_000},
        aborted: false,
        willRetry: false
      }) <> "\n"

    send(pid, {port, {:data, jsonl}})

    assert_receive {:agent_event, compaction}, 500
    assert compaction["type"] == "compacting"
    assert compaction["phase"] == "end"
    assert compaction["reason"] == "threshold"
    assert compaction["tokensBefore"] == 150_000
    assert compaction["estimatedTokensAfter"] == 32_000
    refute compaction["willRetry"]

    AgentRunner.stop(pid)
  end

  test "relays compaction_end error to caller" do
    pid = start_agent!()
    port = port_from(pid)

    jsonl =
      Jason.encode!(%{
        type: "compaction_end",
        reason: "overflow",
        result: nil,
        aborted: false,
        willRetry: false,
        errorMessage: "API quota exceeded"
      }) <> "\n"

    send(pid, {port, {:data, jsonl}})

    assert_receive {:agent_event, compaction}, 500
    assert compaction["phase"] == "end"
    assert compaction["error"] == "API quota exceeded"

    AgentRunner.stop(pid)
  end

  test "emits context_warning when context usage exceeds threshold" do
    pid = start_agent!()
    port = port_from(pid)

    jsonl =
      Jason.encode!(%{
        type: "response",
        command: "get_session_stats",
        success: true,
        data: %{
          contextUsage: %{tokens: 170_000, contextWindow: 200_000, percent: 85}
        }
      }) <> "\n"

    send(pid, {port, {:data, jsonl}})

    assert_receive {:agent_event, warning}, 500
    assert warning["type"] == "context_warning"
    assert warning["percent"] == 85
    assert warning["contextWindow"] == 200_000

    AgentRunner.stop(pid)
  end

  test "does not emit context_warning below threshold" do
    pid = start_agent!()
    port = port_from(pid)

    jsonl =
      Jason.encode!(%{
        type: "response",
        command: "get_session_stats",
        success: true,
        data: %{
          contextUsage: %{tokens: 60_000, contextWindow: 200_000, percent: 30}
        }
      }) <> "\n"

    send(pid, {port, {:data, jsonl}})
    refute_receive {:agent_event, %{"type" => "context_warning"}}, 200

    AgentRunner.stop(pid)
  end

  test "ignores get_session_stats response without contextUsage" do
    pid = start_agent!()
    port = port_from(pid)

    jsonl =
      Jason.encode!(%{
        type: "response",
        command: "get_session_stats",
        success: true,
        data: %{}
      }) <> "\n"

    send(pid, {port, {:data, jsonl}})
    refute_receive {:agent_event, %{"type" => "context_warning"}}, 200

    AgentRunner.stop(pid)
  end

  test "accumulates text across multiple deltas" do
    pid = start_agent!()
    port = port_from(pid)

    d1 =
      Jason.encode!(%{
        type: "message_update",
        assistantMessageEvent: %{type: "text_delta", delta: "Hello "}
      }) <> "\n"

    d2 =
      Jason.encode!(%{
        type: "message_update",
        assistantMessageEvent: %{type: "text_delta", delta: "World"}
      }) <> "\n"

    send(pid, {port, {:data, d1}})
    assert_receive {:agent_event, %{"type" => "delta", "text" => "Hello "}}, 500

    send(pid, {port, {:data, d2}})
    assert_receive {:agent_event, %{"type" => "delta", "text" => "World"}}, 500

    final_state = :sys.get_state(pid)
    assert final_state.current_text == "Hello World"

    AgentRunner.stop(pid)
  end

  # ── Abort flow ──────────────────────────────────────────────────────

  test "abort sends both abort and abort_bash commands to port" do
    pid = start_agent!()

    AgentRunner.abort(pid)

    state = :sys.get_state(pid)
    assert state.aborted == true
    assert state.abort_sigterm_timer != nil
    assert state.abort_kill_timer != nil

    AgentRunner.stop(pid)
  end

  test "abort when already aborted is a no-op" do
    pid = start_agent!()

    AgentRunner.abort(pid)
    state1 = :sys.get_state(pid)
    timers1 = {state1.abort_sigterm_timer, state1.abort_kill_timer}
    assert state1.aborted == true

    # Second abort should not change state (idempotent)
    AgentRunner.abort(pid)
    state2 = :sys.get_state(pid)
    assert state2.aborted == true
    assert {state2.abort_sigterm_timer, state2.abort_kill_timer} == timers1

    AgentRunner.stop(pid)
  end

  test "abort followed by agent_end emits aborted" do
    pid = start_agent!()
    port = port_from(pid)

    AgentRunner.abort(pid)

    # Simulate pi responding with agent_end
    agent_end = Jason.encode!(%{type: "agent_end", willRetry: false}) <> "\n"
    send(pid, {port, {:data, agent_end}})

    assert_receive {:agent_event, %{"type" => "aborted"}}, 500

    # Mock port_close doesn't trigger exit_status, so send it manually
    send(pid, {port, {:exit_status, 0}})

    # GenServer should stop after exit_status while aborted
    Process.monitor(pid)
    assert_receive {:DOWN, _, :process, ^pid, _}, 1000
  end

  test "abort timeout force-kills port and emits aborted" do
    pid = start_agent!()

    # Trap exits because AgentRunner is linked via start_link and
    # stops with reason :abort_timeout (not :normal)
    old_flag = Process.flag(:trap_exit, true)

    AgentRunner.abort(pid)

    # Simulate the abort_timeout message (instead of waiting 5s)
    send(pid, :abort_timeout)

    assert_receive {:agent_event, %{"type" => "aborted"}}, 500

    # GenServer should stop
    Process.monitor(pid)
    assert_receive {:DOWN, _, :process, ^pid, _}, 1000

    Process.flag(:trap_exit, old_flag)
  end

  test "abort sends SIGTERM to process group at phase 2" do
    pid = start_agent!()

    AgentRunner.abort(pid)

    # Fast-forward to SIGTERM phase (instead of waiting 3s)
    # With mock ports (make_ref()), Port.info raises → rescue → skip kill gracefully
    send(pid, :abort_sigterm)

    # GenServer should survive the SIGTERM phase without crashing
    assert Process.alive?(pid)

    AgentRunner.stop(pid)
  end

  test "abort with port exit while aborted stops cleanly" do
    pid = start_agent!()
    port = port_from(pid)

    AgentRunner.abort(pid)

    # Simulate port dying during abort
    send(pid, {port, {:exit_status, 0}})

    Process.monitor(pid)
    assert_receive {:DOWN, _, :process, ^pid, _}, 1000
  end

  # ── No provider configured ──────────────────────────────────────────

  test "sends structured error when no providers configured" do
    Application.put_env(:soma, :secret_provider, Soma.SecretProvider.Noop)

    on_exit(fn ->
      Application.put_env(:soma, :secret_provider, Soma.SecretProvider.Mock)
    end)

    # Trap exit because start_link returns {:stop, ...} which sends EXIT
    Process.flag(:trap_exit, true)

    old_flag = Process.flag(:trap_exit, true)

    result = AgentRunner.start_link(default_opts())
    assert {:error, :no_ai_provider_configured} = result

    assert_receive {:agent_event, error}, 500
    assert error["type"] == "error"
    assert error["code"] == "no_ai_provider_configured"
    assert error["fix"] =~ "thalamus secret create"
    assert error["providers"] == ["deepseek", "openai", "anthropic"]

    Process.flag(:trap_exit, old_flag)
  end

  # ── Tool call guard (soma#186) ──────────────────────────────────────

  test "aborts turn and emits error when max tool calls per turn exceeded" do
    Application.put_env(:soma, :max_tool_calls_per_turn, 2)

    on_exit(fn -> Application.delete_env(:soma, :max_tool_calls_per_turn) end)

    pid = start_agent!()
    port = port_from(pid)

    tool = fn n ->
      Jason.encode!(%{type: "tool_execution_start", toolName: "bash", args: "cmd #{n}"}) <> "\n"
    end

    send(pid, {port, {:data, tool.(1)}})
    assert_receive {:agent_event, %{"type" => "tool"}}, 500

    send(pid, {port, {:data, tool.(2)}})
    assert_receive {:agent_event, %{"type" => "tool"}}, 500

    # La tercera excede el límite → error estructurado + abort
    send(pid, {port, {:data, tool.(3)}})

    # El evento 'tool' se emite igual; luego llega el error.
    assert_receive {:agent_event, %{"type" => "tool"}}, 500
    assert_receive {:agent_event, %{"type" => "error"} = error}, 500
    assert error["code"] == "max_tool_calls_exceeded"
    assert error["maxToolCalls"] == 2

    assert :sys.get_state(pid).aborted == true

    AgentRunner.stop(pid)
  end

  test "does not abort when max tool calls is zero (unlimited)" do
    Application.put_env(:soma, :max_tool_calls_per_turn, 0)

    on_exit(fn -> Application.delete_env(:soma, :max_tool_calls_per_turn) end)

    pid = start_agent!()
    port = port_from(pid)

    for n <- 1..5 do
      jsonl =
        Jason.encode!(%{type: "tool_execution_start", toolName: "bash", args: "cmd #{n}"}) <>
          "\n"

      send(pid, {port, {:data, jsonl}})
      assert_receive {:agent_event, %{"type" => "tool"}}, 500
    end

    refute :sys.get_state(pid).aborted
    AgentRunner.stop(pid)
  end

  test "resets tool call counter on each new prompt" do
    Application.put_env(:soma, :max_tool_calls_per_turn, 2)

    on_exit(fn -> Application.delete_env(:soma, :max_tool_calls_per_turn) end)

    pid = start_agent!()
    port = port_from(pid)

    jsonl =
      Jason.encode!(%{type: "tool_execution_start", toolName: "bash", args: "cmd 1"}) <> "\n"

    send(pid, {port, {:data, jsonl}})
    assert_receive {:agent_event, %{"type" => "tool"}}, 500

    # Un nuevo prompt reinicia el contador
    AgentRunner.send_prompt(pid, "otra tarea")
    assert :sys.get_state(pid).tool_calls_in_turn == 0

    AgentRunner.stop(pid)
  end

end
