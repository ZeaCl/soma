defmodule SomaWeb.Plugs.JWTAuthTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias SomaWeb.Plugs.JWTAuth

  setup do
    Application.put_env(:soma, :thalamus_client, Soma.ThalamusClient.Mock)
    Soma.ThalamusClient.Mock.start_link(%{})
    on_exit(fn -> Application.delete_env(:soma, :thalamus_client) end)
  end

  test "init returns opts" do
    assert JWTAuth.init([]) == []
    assert JWTAuth.init(%{key: :val}) == %{key: :val}
  end

  test "call without auth header passes through" do
    conn = conn(:get, "/test") |> JWTAuth.call(JWTAuth.init([]))
    refute conn.halted
    refute conn.assigns[:authenticated]
  end

  test "call with malformed auth header passes through" do
    conn =
      :get
      |> conn("/test")
      |> put_req_header("authorization", "NotBearer xyz")
      |> JWTAuth.call(JWTAuth.init([]))

    refute conn.halted
  end

  test "call with invalid JWT passes through (no crash)" do
    conn =
      :get
      |> conn("/test")
      |> put_req_header("authorization", "Bearer invalid.token.here")
      |> JWTAuth.call(JWTAuth.init([]))

    refute conn.halted
    refute conn.assigns[:authenticated]
  end

  test "call with empty Bearer token passes through" do
    conn =
      :get
      |> conn("/test")
      |> put_req_header("authorization", "Bearer ")
      |> JWTAuth.call(JWTAuth.init([]))

    refute conn.halted
  end

  test "verify_token with invalid token returns error" do
    assert {:error, _reason} = JWTAuth.verify_token("invalid.token.format")
  end
end
