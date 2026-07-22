defmodule Soma.FileSystem do
  @moduledoc """
  Operaciones de sistema de archivos — extraído para permitir inyección de dependencias.
  """

  @callback read(binary()) :: {:ok, binary()} | {:error, term()}
  @callback read!(binary()) :: binary() | no_return()
  @callback write(binary(), binary()) :: :ok | {:error, term()}
  @callback mkdir_p(binary()) :: :ok | {:error, term()}
  @callback exists?(binary()) :: boolean()
  @callback dir?(binary()) :: boolean()
  @callback ls(binary()) :: {:ok, [binary()]} | {:error, term()}
  @callback rm(binary()) :: :ok | {:error, term()}
  @callback rmdir(binary()) :: :ok | {:error, term()}
  @callback rm_rf(binary()) :: {:ok, [binary()]} | {:error, term()}
  @callback rename(binary(), binary()) :: :ok | {:error, term()}
  @callback stat(binary()) :: %{size: non_neg_integer()} | {:error, term()}
  @callback cp_r(binary(), binary()) :: {:ok, [binary()]} | {:error, term()}

  def impl do
    Application.get_env(:soma, :file_system, Soma.FileSystem.Real)
  end
end
