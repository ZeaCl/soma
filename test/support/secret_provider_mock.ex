defmodule Soma.SecretProvider.Mock do
  @moduledoc "Mock de SecretProvider para tests."
  @behaviour Soma.SecretProvider

  @impl true
  def resolve_secret(_org_id, _user_id, provider) do
    # Returns a mock key for all providers by default
    {:ok, "mock-key-#{provider}"}
  end
end
