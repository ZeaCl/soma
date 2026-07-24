defmodule Soma.SecretProvider.Noop do
  @moduledoc "SecretProvider que nunca devuelve keys — simula org sin proveedores configurados."
  @behaviour Soma.SecretProvider

  @impl true
  def resolve_secret(_org_id, _user_id, _provider), do: {:error, :not_found}
end
