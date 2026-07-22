defmodule SomaWeb.AuthRouterTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias Soma.Repo
  alias SomaWeb.Plugs.AuthRouter

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Application.put_env(:soma, :thalamus_client, Soma.ThalamusClient.Mock)
    Application.put_env(:soma, :shell, Soma.Shell.Mock)
    Soma.ThalamusClient.Mock.start_link(%{})
    Soma.Shell.Mock.start_link(%{})
    on_exit(fn ->
      Application.delete_env(:soma, :thalamus_client)
      Application.delete_env(:soma, :shell)
    end)
  end

  test "routes /conversations" do
    conn = conn(:get, "/conversations") |> AuthRouter.call(AuthRouter.init([]))
    assert conn.status in [401, 200]
  end

  test "routes /skills" do
    conn = conn(:get, "/skills") |> AuthRouter.call(AuthRouter.init([]))
    assert conn.status in [401, 200]
  end

  test "routes /agents" do
    conn = conn(:get, "/agents") |> AuthRouter.call(AuthRouter.init([]))
    assert conn.status in [401, 200]
  end

  test "routes /files" do
    conn = conn(:get, "/files") |> AuthRouter.call(AuthRouter.init([]))
    assert conn.status in [401, 200]
  end

  test "routes /sandboxes" do
    conn = conn(:get, "/sandboxes?owner_type=agent&owner_id=x") |> AuthRouter.call(AuthRouter.init([]))
    assert conn.status in [401, 200]
  end

  test "routes /api-keys" do
    conn = conn(:post, "/api-keys") |> AuthRouter.call(AuthRouter.init([]))
    assert conn.status in [401, 201]
  end

  test "unknown route returns 404" do
    conn = conn(:get, "/no-existe") |> AuthRouter.call(AuthRouter.init([]))
    assert conn.status == 404
  end
end
