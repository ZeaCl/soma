defmodule Soma.Shell.Real do
  @moduledoc "Implementación real — System.cmd y Port.open."
  @behaviour Soma.Shell

  @impl true
  def cmd(executable, args, opts \\ []) do
    System.cmd(executable, args, opts)
  end

  @impl true
  def spawn_port(executable, args) do
    Port.open(
      {:spawn_executable, executable},
      [:binary, :stream, :use_stdio, :exit_status, args: args]
    )
  end
end
