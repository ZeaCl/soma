defmodule SomaWeb.Plugs.Guard do
  import Plug.Conn

  def init(opts), do: opts

  def call(%{assigns: %{authenticated: true}} = conn, _opts), do: conn

  # Dev bypass: x-test-user-id header (solo en entornos no-prod)
  def call(conn, _opts) do
    test_user = Plug.Conn.get_req_header(conn, "x-test-user-id") |> List.first()
    env = Application.get_env(:soma, :environment, :dev)

    if test_user && env != :prod do
      conn
      |> assign(:user_id, test_user)
      |> assign(:org_id, "00000000-0000-0000-0000-000000000000")
      |> assign(:authenticated, true)
    else
      conn
      |> put_resp_content_type("application/json")
      |> send_resp(401, Jason.encode!(%{error: "unauthorized", detail: "missing_jwt_or_api_key"}))
      |> halt()
    end
  end
end
