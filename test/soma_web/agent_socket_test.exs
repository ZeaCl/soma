defmodule SomaWeb.AgentSocketTest do
  use ExUnit.Case, async: false

  alias SomaWeb.AgentSocket
  alias Soma.Repo

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Application.put_env(:soma, :shell, Soma.Shell.Mock)
    Soma.Shell.Mock.start_link(%{})
    on_exit(fn -> Application.delete_env(:soma, :shell) end)
  end

  test "init returns state" do
    assert {:ok, state} = AgentSocket.init(%{})
    assert state[:agent_runner] == nil
  end

  test "handle_in with unknown command returns error" do
    state = %{agent_runner: nil}
    result = AgentSocket.handle_in({Jason.encode!(%{type: "unknown"}), [opcode: :text]}, state)
    assert {:push, {:text, json}, _state} = result
    assert Jason.decode!(json)["type"] == "error"
  end

  test "handle_in with cancel when no runner pushes cancelled" do
    state = %{agent_runner: nil}
    result = AgentSocket.handle_in({Jason.encode!(%{type: "cancel"}), [opcode: :text]}, state)
    assert {:push, {:text, json}, _state} = result
    assert Jason.decode!(json)["type"] == "cancelled"
  end

  test "handle_in with prompt when not initialized returns error" do
    state = %{agent_runner: nil}
    result = AgentSocket.handle_in({Jason.encode!(%{type: "prompt", text: "hi"}), [opcode: :text]}, state)
    assert {:push, {:text, json}, _state} = result
    assert Jason.decode!(json)["type"] == "error"
  end

  test "handle_in with non-text frame is ignored" do
    state = %{agent_runner: nil}
    assert {:ok, ^state} = AgentSocket.handle_in({"data", [opcode: :binary]}, state)
  end

  test "handle_info with agent_event forwards to client" do
    state = %{agent_runner: nil}
    result = AgentSocket.handle_info({:agent_event, %{"type" => "delta", "text" => "hi"}}, state)
    assert {:push, {:text, json}, ^state} = result
    assert Jason.decode!(json)["type"] == "delta"
  end

  test "handle_info with unknown message is ignored" do
    state = %{agent_runner: nil}
    assert {:ok, ^state} = AgentSocket.handle_info(:unknown, state)
  end

  test "terminate with runner stops it" do
    {:ok, pid} = Soma.AgentRunner.start_link(caller: self(), agent_id: "test", token: "t")
    assert_receive {:agent_event, %{"type" => "ready"}}, 500
    state = %{agent_runner: pid}
    assert :ok = AgentSocket.terminate(:normal, state)
    refute Process.alive?(pid)
  end

  test "terminate without runner is no-op" do
    state = %{agent_runner: nil}
    assert :ok = AgentSocket.terminate(:normal, state)
  end
end
