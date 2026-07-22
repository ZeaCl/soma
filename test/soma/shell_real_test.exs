defmodule Soma.ShellRealTest do
  use ExUnit.Case, async: true

  alias Soma.Shell.Real

  test "cmd/3 executes shell command" do
    {output, 0} = Real.cmd("echo", ["hello test"], stderr_to_stdout: true)
    assert output =~ "hello test"
  end

  test "cmd/3 returns error code for failures" do
    {_output, code} = Real.cmd("sh", ["-c", "exit 42"], stderr_to_stdout: true)
    assert code == 42
  end

  test "spawn_port/2 creates a port" do
    port = Real.spawn_port({:spawn, "echo hello"}, [:binary, :use_stdio])
    assert is_port(port)
    Port.close(port)
  end

  test "port_command/2 and port_close/1 flow" do
    port = Real.spawn_port({:spawn, "cat"}, [:binary, :use_stdio])
    assert is_port(port)
    assert Real.port_command(port, "test\n")
    assert Real.port_close(port)
  end
end
