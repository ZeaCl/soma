defmodule Soma.Shell.Real do
  @moduledoc "Implementación real — System.cmd y Port.open."
  @behaviour Soma.Shell

  @impl true
  def cmd(executable, args, opts \\ []) do
    System.cmd(executable, args, opts)
  end

  @impl true
  def spawn_port(port_spec, options) do
    Port.open(port_spec, options)
  end

  @impl true
  def port_command(port, data) do
    Port.command(port, data)
  end

  @impl true
  def port_close(port) do
    Port.close(port)
  end
end
