defmodule Soma.Shell do
  @moduledoc """
  Shell command execution — extraído para permitir inyección de dependencias.

  En producción usa System.cmd y Port.open. En tests se puede reemplazar con un mock.
  """

  @callback cmd(binary(), [binary()], keyword()) :: {binary(), integer()}
  @callback spawn_port(tuple(), [term()]) :: port()
  @callback port_command(port(), binary()) :: boolean()
  @callback port_close(port()) :: boolean()

  def impl do
    Application.get_env(:soma, :shell, Soma.Shell.Real)
  end
end
