defmodule Soma.SecretProvider do
  @moduledoc """
  Behaviour para resolver secrets de proveedores IA.

  Soma no se acopla a Thalamus — define esta abstracción y usa
  la implementación configurada en `:soma, :secret_provider`.
  """

  @callback resolve_secret(org_id :: String.t(), user_id :: String.t(), provider :: String.t()) ::
              {:ok, String.t()} | {:error, :not_found | term()}

  @doc """
  Devuelve el módulo configurado (default: Thalamus).
  """
  def impl do
    Application.get_env(:soma, :secret_provider, Soma.SecretProvider.Thalamus)
  end
end
