defmodule Soma.ThalamusClient.Real do
  @moduledoc "Implementación real — usa Req para llamar a Thalamus."
  @behaviour Soma.ThalamusClient

  defp base_url do
    Application.get_env(:soma, :thalamus)[:url]
  end

  @impl true
  def get_user(token) do
    headers = if token, do: [authorization: "Bearer #{token}"], else: []

    case Req.get("#{base_url()}/api/users?is_agent=true",
           headers: headers,
           receive_timeout: 5000
         ) do
      {:ok, %{status: 200, body: body}} ->
        {:ok, body["data"] || body["users"] || []}

      _ ->
        {:ok, []}
    end
  end

  @impl true
  def create_user(attrs, token) do
    headers = if token, do: [authorization: "Bearer #{token}"], else: []

    case Req.post("#{base_url()}/api/users",
           json: attrs,
           headers: headers,
           receive_timeout: 5000
         ) do
      {:ok, %{status: 201, body: resp}} ->
        {:ok, resp["data"] || resp}

      {:ok, %{status: code, body: resp}} ->
        {:error, resp["error"] || "Thalamus returned #{code}"}

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end

  @impl true
  def update_user(agent_id, config, _token) do
    case Req.patch("#{base_url()}/api/users/#{agent_id}",
           json: %{agent_config: config},
           receive_timeout: 5000
         ) do
      {:ok, %{status: 200}} ->
        {:ok, config}

      {:ok, %{status: code}} ->
        {:error, "Thalamus returned #{code}"}

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end

  @impl true
  def delete_user(agent_id) do
    case Req.delete("#{base_url()}/api/users/#{agent_id}",
           receive_timeout: 5000
         ) do
      {:ok, %{status: code}} when code in [200, 204] -> :ok
      {:ok, %{status: 404}} -> {:error, :not_found}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  @impl true
  def get_user_by_id(agent_id) do
    case Req.get("#{base_url()}/api/users/#{agent_id}",
           receive_timeout: 5000
         ) do
      {:ok, %{status: 200, body: body}} ->
        {:ok, body["data"] || body}

      {:ok, %{status: 404}} ->
        {:error, :not_found}

      {:error, _} ->
        {:error, :not_found}
    end
  end

  @impl true
  def get_jwks do
    jwks_url = Application.get_env(:soma, :thalamus)[:jwks_url]

    case Req.get(jwks_url, receive_timeout: 5000) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      _ -> {:error, :jwks_unavailable}
    end
  end

  @impl true
  def login(email, password) do
    case Req.post("#{base_url()}/api/public/login",
           json: %{email: email, password: password},
           receive_timeout: 5000
         ) do
      {:ok, %{status: 200, body: body}} ->
        {:ok, body}

      {:ok, %{status: code, body: body}} ->
        {:error, body["error"] || "Login failed (HTTP #{code})"}

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end
end
