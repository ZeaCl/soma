defmodule SomaWeb.Plugs.ApiKeyAuth do
  @moduledoc "Validates API Key (zs_live_...) for programmatic access."

  import Plug.Conn
  alias Soma.ApiKey
  alias Soma.Repo

  def init(opts), do: opts

  def call(%{assigns: %{authenticated: true}} = conn, _opts), do: conn

  def call(conn, _opts) do
    case get_req_header(conn, "x-api-key") do
      [raw_key | _] when byte_size(raw_key) > 20 ->
        key_hash = :crypto.hash(:sha256, raw_key) |> Base.encode64()

        case Repo.get_by(ApiKey, key_hash: key_hash, is_active: true) do
          %ApiKey{organization_id: org_id, scopes: scopes} = key ->
            ApiKey.touch_last_used(key)

            conn
            |> assign(:org_id, org_id)
            |> assign(:api_key_scopes, scopes)
            |> assign(:authenticated, true)

          nil ->
            conn
            |> send_resp(401, Jason.encode!(%{error: "unauthorized", detail: "invalid_api_key"}))
            |> halt()
        end

      _ ->
        # No API key provided — let Guard or JWTAuth handle auth
        conn
    end
  end
end
