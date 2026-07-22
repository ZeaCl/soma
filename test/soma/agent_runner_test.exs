defmodule Soma.AgentRunnerTest do
  use ExUnit.Case, async: true

  alias Soma.AgentRunner

  @agent "test-agent-000000000001"
  @token "test-token"

  setup do
    Application.put_env(:soma, :shell, Soma.Shell.Mock)
    Application.put_env(:soma, :file_system, Soma.FileSystem.Mock)
    Soma.Shell.Mock.start_link(%{})
    Soma.FileSystem.Mock.start_link(%{})
    :ok
  end

  # ── API ──────────────────────────────────────────────────────────────

  test "start_link starts a GenServer and sends ready to caller" do
    {:ok, pid} = AgentRunner.start_link(caller: self(), agent_id: @agent, token: @token)
    assert is_pid(pid)
    assert_receive {:agent_event, %{"type" => "ready"}}, 1000
    AgentRunner.stop(pid)
  end

  test "send_prompt and abort do not crash" do
    {:ok, pid} = AgentRunner.start_link(caller: self(), agent_id: @agent, token: @token)
    assert_receive {:agent_event, %{"type" => "ready"}}, 500

    AgentRunner.send_prompt(pid, "hello")
    AgentRunner.abort(pid)
    # Stop and wait for exit message
    AgentRunner.stop(pid)
    refute Process.alive?(pid)
  end

  # ── JSONL processing via port messages ───────────────────────────────

  test "processes JSONL text delta from port" do
    {:ok, pid} = AgentRunner.start_link(caller: self(), agent_id: @agent, token: @token)
    assert_receive {:agent_event, %{"type" => "ready"}}, 500

    # Get the port ref from state
    state = :sys.get_state(pid)
    port = state.port

    # Simulate pi stdout via JSONL
    jsonl = Jason.encode!(%{type: "message_update", assistantMessageEvent: %{type: "text_delta", delta: "Hola "}}) <> "\n"
    send(pid, {port, {:data, jsonl}})
    assert_receive {:agent_event, %{"type" => "delta", "text" => "Hola "}}, 500

    AgentRunner.stop(pid)
  end

  test "processes thinking events from port" do
    {:ok, pid} = AgentRunner.start_link(caller: self(), agent_id: @agent, token: @token)
    assert_receive {:agent_event, %{"type" => "ready"}}, 500

    state = :sys.get_state(pid)
    port = state.port

    jsonl = Jason.encode!(%{type: "message_update", assistantMessageEvent: %{type: "thinking_start"}}) <> "\n"
    send(pid, {port, {:data, jsonl}})
    assert_receive {:agent_event, %{"type" => "thinking_start"}}, 500

    AgentRunner.stop(pid)
  end

  test "processes tool execution from port" do
    {:ok, pid} = AgentRunner.start_link(caller: self(), agent_id: @agent, token: @token)
    assert_receive {:agent_event, %{"type" => "ready"}}, 500

    state = :sys.get_state(pid)
    port = state.port

    jsonl = Jason.encode!(%{type: "tool_execution_start", toolName: "bash", args: "ls"}) <> "\n"
    send(pid, {port, {:data, jsonl}})
    assert_receive {:agent_event, %{"type" => "tool", "name" => "bash", "input" => "ls"}}, 500

    AgentRunner.stop(pid)
  end

  test "processes agent_end done from port" do
    {:ok, pid} = AgentRunner.start_link(caller: self(), agent_id: @agent, token: @token)
    assert_receive {:agent_event, %{"type" => "ready"}}, 500

    state = :sys.get_state(pid)
    port = state.port

    # First send some text
    delta = Jason.encode!(%{type: "message_update", assistantMessageEvent: %{type: "text_delta", delta: "OK"}}) <> "\n"
    send(pid, {port, {:data, delta}})
    assert_receive {:agent_event, %{"type" => "delta"}}, 500

    # Then done
    done = Jason.encode!(%{type: "agent_end", willRetry: false}) <> "\n"
    send(pid, {port, {:data, done}})
    assert_receive {:agent_event, %{"type" => "done", "final_text" => "OK"}}, 500

    AgentRunner.stop(pid)
  end

  test "handles port exit" do
    {:ok, pid} = AgentRunner.start_link(caller: self(), agent_id: @agent, token: @token)
    assert_receive {:agent_event, %{"type" => "ready"}}, 500

    state = :sys.get_state(pid)
    port = state.port

    send(pid, {port, {:exit_status, 1}})
    assert_receive {:agent_event, %{"type" => "error", "message" => "Agent process exited with code 1"}}, 500

    refute Process.alive?(pid)
  end

  test "accumulates text across multiple deltas" do
    {:ok, pid} = AgentRunner.start_link(caller: self(), agent_id: @agent, token: @token)
    assert_receive {:agent_event, %{"type" => "ready"}}, 500

    state = :sys.get_state(pid)
    port = state.port

    d1 = Jason.encode!(%{type: "message_update", assistantMessageEvent: %{type: "text_delta", delta: "Hello "}}) <> "\n"
    d2 = Jason.encode!(%{type: "message_update", assistantMessageEvent: %{type: "text_delta", delta: "World"}}) <> "\n"

    send(pid, {port, {:data, d1}})
    assert_receive {:agent_event, %{"type" => "delta", "text" => "Hello "}}, 500

    send(pid, {port, {:data, d2}})
    assert_receive {:agent_event, %{"type" => "delta", "text" => "World"}}, 500

    # State should have accumulated both
    final_state = :sys.get_state(pid)
    assert final_state.current_text == "Hello World"

    AgentRunner.stop(pid)
  end
end
