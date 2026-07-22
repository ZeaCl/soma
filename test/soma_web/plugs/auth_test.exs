defmodule SomaWeb.Plugs.AuthTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias SomaWeb.Plugs.{JWTAuth, ApiKeyAuth, Guard}

  @org_id "00000000-0000-0000-0000-000000000001"

  setup do
    Application.put_env(:soma, :thalamus_client, Soma.ThalamusClient.Mock)
    Soma.ThalamusClient.Mock.start_link(%{})

    on_exit(fn ->
      Application.delete_env(:soma, :thalamus_client)
    end)

    :ok
  end

  # ── JWTAuth ──────────────────────────────────────────────────────────

  test "call/2 without Authorization header passes through" do
    conn =
      :get
      |> conn("/api/test")
      |> JWTAuth.call(JWTAuth.init([]))

    refute conn.halted
    refute conn.assigns[:authenticated]
  end

  test "call/2 with malformed Authorization header passes through" do
    conn =
      :get
      |> conn("/api/test")
      |> put_req_header("authorization", "InvalidFormat")
      |> JWTAuth.call(JWTAuth.init([]))

    refute conn.halted
    refute conn.assigns[:authenticated]
  end

  test "call/2 with invalid Bearer token passes through (no crash)" do
    conn =
      :get
      |> conn("/api/test")
      |> put_req_header("authorization", "Bearer invalid.token.here")
      |> JWTAuth.call(JWTAuth.init([]))

    refute conn.halted
  end

  # ── ApiKeyAuth ───────────────────────────────────────────────────────

  test "call/2 without x-api-key passes through" do
    conn =
      :get
      |> conn("/api/test")
      |> ApiKeyAuth.call(ApiKeyAuth.init([]))

    refute conn.halted
  end

  test "call/2 with too-short API key passes through" do
    conn =
      :get
      |> conn("/api/test")
      |> put_req_header("x-api-key", "short")
      |> ApiKeyAuth.call(ApiKeyAuth.init([]))

    refute conn.halted
    refute conn.assigns[:authenticated]
  end

  # ── Guard ────────────────────────────────────────────────────────────

  test "call/2 with authenticated user passes through" do
    conn =
      :get
      |> conn("/api/test")
      |> assign(:authenticated, true)
      |> assign(:org_id, @org_id)
      |> Guard.call(Guard.init([]))

    refute conn.halted
  end

  test "call/2 without authentication returns 401" do
    conn =
      :get
      |> conn("/api/test")
      |> Guard.call(Guard.init([]))

    assert conn.halted
    assert conn.status == 401
  end

  test "call/2 with x-test-user-id in dev mode authenticates" do
    conn =
      :get
      |> conn("/api/test")
      |> put_req_header("x-test-user-id", "test-user-123")
      |> Guard.call(Guard.init([]))

    refute conn.halted
    assert conn.assigns[:authenticated]
    assert conn.assigns[:user_id] == "test-user-123"
  end
end
