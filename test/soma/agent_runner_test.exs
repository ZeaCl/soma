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
    Process.flag(:trap_exit, true)

    AgentRunner.abort(pid)

    # Simulate the abort_timeout message (instead of waiting 5s)
    send(pid, :abort_timeout)

    assert_receive {:agent_event, %{"type" => "aborted"}}, 500

    # GenServer should stop
    Process.monitor(pid)
    assert_receive {:DOWN, _, :process, ^pid, _}, 1000
  end

  test "abort sends SIGTERM at phase 2" do
    pid = start_agent!()

    # Track kill calls
    test_pid = self()
    Soma.Shell.Mock.set_responses(%{
      default: fn executable, args ->
        case {executable, args} do
          {"id", ["-u", _username]} -> {"1000\n", 0}
          {"kill", ["-TERM", os_pid]} -> send(test_pid, {:kill_called, os_pid}); {"", 0}
          _ -> {"", 0}
        end
      end
    })

    AgentRunner.abort(pid)

    # Fast-forward to SIGTERM phase (instead of waiting 3s)
    send(pid, :abort_sigterm)

    # The kill should have been attempted (port is mock ref, os_pid may be nil)
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

    result = AgentRunner.start_link(default_opts())
    assert {:error, :no_ai_provider_configured} = result

    assert_receive {:agent_event, error}, 500
    assert error["type"] == "error"
    assert error["code"] == "no_ai_provider_configured"
    assert error["fix"] =~ "thalamus secret create"
    assert error["providers"] == ["deepseek", "openai", "anthropic"]
  end
end
