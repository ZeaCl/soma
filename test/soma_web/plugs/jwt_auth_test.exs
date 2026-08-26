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

  test "normalize_user_id strips user_ prefix" do
    assert JWTAuth.normalize_user_id("user_123") == "123"
    assert JWTAuth.normalize_user_id("123") == "123"
  end

  test "normalize_org_id strips org_ prefix" do
    assert JWTAuth.normalize_org_id("org_ea7b11ea-852c-44e5-aee1-a761ec76eaea") ==
             "ea7b11ea-852c-44e5-aee1-a761ec76eaea"

    assert JWTAuth.normalize_org_id("ea7b11ea-852c-44e5-aee1-a761ec76eaea") ==
             "ea7b11ea-852c-44e5-aee1-a761ec76eaea"

    assert JWTAuth.normalize_org_id(nil) == nil
  end
end
