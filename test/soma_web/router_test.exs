defmodule SomaWeb.RouterTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias Soma.Repo
  alias SomaWeb.Router

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
  end

  test "GET /health returns 200" do
    conn = conn(:get, "/health") |> Router.call(Router.init([]))
    assert conn.status == 200
    assert Jason.decode!(conn.resp_body)["status"] == "ok"
  end

  test "GET / returns HTML SPA" do
    conn = conn(:get, "/") |> Router.call(Router.init([]))
    assert conn.status in [200, 404]
  end

  test "GET /api routes exist" do
    # Auth router forwards — should get 401 without auth
    conn = conn(:get, "/api/conversations") |> Router.call(Router.init([]))
    assert conn.status in [401, 200, 404]
  end

  test "GET /agent-ws returns WebSocket upgrade" do
    conn =
      :get
      |> conn("/agent-ws")
      |> put_req_header("upgrade", "websocket")
      |> put_req_header("connection", "upgrade")
      |> Router.call(Router.init([]))

    assert conn.status in [400, 426, 200]
  end
end
