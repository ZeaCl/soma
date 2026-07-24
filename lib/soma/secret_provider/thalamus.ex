defmodule Soma.SecretProvider.Thalamus do
  @moduledoc "Adapter que resuelve secrets llamando al endpoint interno de Thalamus."
  @behaviour Soma.SecretProvider

  @impl true
  def resolve_secret(org_id, user_id, provider) do
    case Soma.ThalamusClient.impl().resolve_secret(org_id, user_id, provider) do
      {:ok, value} -> {:ok, value}
      {:error, :not_found} -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end
end
