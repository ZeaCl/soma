defmodule Soma.ThalamusClient.Mock do
  @moduledoc "Mock de ThalamusClient para tests."
  @behaviour Soma.ThalamusClient

  def start_link(responses \\ %{}) do
    Agent.start_link(fn -> responses end, name: __MODULE__)
  end

  def set_responses(responses) do
    Agent.update(__MODULE__, fn _ -> responses end)
  end

  defp get(key, default) do
    Agent.get(__MODULE__, fn r -> Map.get(r, key, default) end)
  end

  @impl true
  def get_user(token), do: get({:get_user, token}, {:ok, []})
  @impl true
  def create_user(attrs, token),
    do: get({:create_user, attrs["email"]}, {:ok, %{"id" => "mock-id"}})

  @impl true
  def update_user(id, config, token), do: get({:update_user, id}, {:ok, config})
  @impl true
  def get_user_by_id(id),
    do: get({:get_user_by_id, id}, {:ok, %{"id" => id, "name" => "Mock Agent"}})

  @impl true
  def delete_user(id), do: get({:delete_user, id}, :ok)
  @impl true
  def get_jwks, do: get(:jwks, {:ok, %{"keys" => []}})
  @impl true
  def login(email, password), do: get({:login, email}, {:ok, %{"access_token" => "mock-token"}})
end
