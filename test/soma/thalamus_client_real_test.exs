defmodule Soma.ThalamusClientRealTest do
  use ExUnit.Case, async: true

  alias Soma.ThalamusClient.Real

  setup do
    # Point Thalamus to an unreachable URL so we test error handling
    Application.put_env(:soma, :thalamus,
      url: "http://127.0.0.1:19999",
      jwks_url: "http://127.0.0.1:19999/.well-known/jwks.json"
    )

    on_exit(fn ->
      Application.put_env(:soma, :thalamus,
        url: "http://thalamus:4000",
        jwks_url: "http://thalamus:4000/.well-known/jwks.json"
      )
    end)
  end

  test "get_user returns empty on connection error" do
    assert {:ok, []} = Real.get_user(nil)
    assert {:ok, []} = Real.get_user("token")
  end

  test "create_user returns error on connection error" do
    assert {:error, _} = Real.create_user(%{"email" => "test@test.com"}, nil)
  end

  test "update_user returns error on connection error" do
    assert {:error, _} = Real.update_user("agent-1", %{}, nil)
  end

  test "delete_user returns error on connection error" do
    assert {:error, _} = Real.delete_user("agent-1")
  end

  test "get_user_by_id returns error on connection error" do
    assert {:error, :not_found} = Real.get_user_by_id("agent-1")
  end

  test "get_jwks returns error on connection error" do
    assert {:error, :jwks_unavailable} = Real.get_jwks()
  end

  test "login returns error on connection error" do
    assert {:error, _} = Real.login("email", "password")
  end
end
