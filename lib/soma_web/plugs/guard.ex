defmodule SomaWeb.Plugs.Guard do
  import Plug.Conn

  def init(opts), do: opts

  def call(%{assigns: %{authenticated: true}} = conn, _opts), do: conn

  def call(conn, _opts) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(401, Jason.encode!(%{error: "unauthorized", detail: "missing_jwt_or_api_key"}))
    |> halt()
  end
end
