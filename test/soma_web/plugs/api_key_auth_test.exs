defmodule SomaWeb.Plugs.ApiKeyAuthTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias Soma.Repo
  alias Soma.ApiKey
  alias SomaWeb.Plugs.ApiKeyAuth

  @org_id "00000000-0000-0000-0000-000000000001"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)

    # Create a real API key for testing
    prefix = "zs_live_"
    raw_key = prefix <> Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
    key_hash = Base.encode64(:crypto.hash(:sha256, raw_key))

    {:ok, _key} =
      %ApiKey{}
      |> ApiKey.changeset(%{
        name: "test-key",
        key_hash: key_hash,
        key_prefix: prefix,
        organization_id: @org_id,
        scopes: ["soma:read"],
        is_active: true
      })
      |> Repo.insert()

    on_exit(fn -> Repo.delete_all(ApiKey) end)

    {:ok, raw_key: raw_key}
  end

  test "call/2 with valid API key authenticates", %{raw_key: raw_key} do
    conn =
      :get
      |> conn("/api/test")
      |> put_req_header("x-api-key", raw_key)
      |> ApiKeyAuth.call(ApiKeyAuth.init([]))

    refute conn.halted
    assert conn.assigns[:authenticated]
    assert conn.assigns[:org_id] == @org_id
    assert conn.assigns[:api_key_scopes] == ["soma:read"]
  end

  test "call/2 with invalid API key returns 401" do
    conn =
      :get
      |> conn("/api/test")
      |> put_req_header("x-api-key", "zs_live_invalid_key_1234567890abcdef1234567890ab")
      |> ApiKeyAuth.call(ApiKeyAuth.init([]))

    assert conn.halted
    assert conn.status == 401
  end

  test "call/2 without API key passes through" do
    conn =
      :get
      |> conn("/api/test")
      |> ApiKeyAuth.call(ApiKeyAuth.init([]))

    refute conn.halted
    refute conn.assigns[:authenticated]
  end
end
