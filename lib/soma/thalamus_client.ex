defmodule Soma.ThalamusClient do
  @moduledoc """
  Cliente HTTP para Thalamus — extraído para permitir inyección de dependencias.

  En producción usa Req. En tests se puede reemplazar con un mock.
  """

  @callback get_user(token :: String.t() | nil) :: {:ok, list()} | {:error, term()}
  @callback create_user(map(), String.t() | nil) :: {:ok, map()} | {:error, term()}
  @callback update_user(String.t(), map(), String.t() | nil) :: {:ok, map()} | {:error, term()}
  @callback get_user_by_id(String.t()) :: {:ok, map()} | {:error, term()}
  @callback delete_user(String.t()) :: :ok | {:error, term()}
  @callback get_jwks() :: {:ok, map()} | {:error, term()}
  @callback login(String.t(), String.t()) :: {:ok, map()} | {:error, term()}

  @doc """
  Devuelve el módulo cliente configurado (real o mock).
  """
  def impl do
    Application.get_env(:soma, :thalamus_client, Soma.ThalamusClient.Real)
  end
end
