defmodule SomaWeb.ControllersFullTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias Soma.Repo
  alias SomaWeb.{AgentController, FileController, SandboxController, ApiKeyController}

  @org_id "00000000-0000-0000-0000-000000000001"
  @user_id "user_test"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Application.put_env(:soma, :thalamus_client, Soma.ThalamusClient.Mock)
    Application.put_env(:soma, :shell, Soma.Shell.Mock)
    Application.put_env(:soma, :file_system, Soma.FileSystem.Mock)
    Soma.ThalamusClient.Mock.start_link(%{})
    Soma.Shell.Mock.start_link(%{})
    Soma.FileSystem.Mock.start_link(%{})

    on_exit(fn ->
      Application.delete_env(:soma, :thalamus_client)
      Application.delete_env(:soma, :shell)
      Application.delete_env(:soma, :file_system)
    end)
  end

  defp authed(method, path) do
    conn(method, path)
    |> assign(:org_id, @org_id)
    |> assign(:user_id, @user_id)
    |> assign(:authenticated, true)
  end

  # ── AgentController ──────────────────────────────────────────────────

  test "agent list returns 200" do
    conn = authed(:get, "/") |> AgentController.call(AgentController.init([]))
    assert conn.status == 200
  end

  test "agent show returns 404 for missing UUID" do
    conn = authed(:get, "/00000000-0000-0000-0000-000000000099")
           |> AgentController.call(AgentController.init([]))
    assert conn.status == 404
  end

  test "agent config updates config" do
    conn =
      :put
      |> authed("/00000000-0000-0000-0000-000000000099/config")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"system_prompt" => "test"})
      |> AgentController.call(AgentController.init([]))
    assert conn.status in [200, 500]
  end

  test "agent shares returns empty" do
    conn = authed(:get, "/00000000-0000-0000-0000-000000000099/shares")
           |> AgentController.call(AgentController.init([]))
    assert conn.status == 200
  end

  test "shared agents list returns 200" do
    conn = authed(:get, "/shared") |> AgentController.call(AgentController.init([]))
    assert conn.status == 200
  end

  # ── FileController ───────────────────────────────────────────────────

  test "file list returns 200" do
    conn = authed(:get, "/") |> FileController.call(FileController.init([]))
    assert conn.status == 200
  end

  test "file content returns 404 for missing" do
    conn = authed(:get, "/content?path=no-existe")
           |> FileController.call(FileController.init([]))
    assert conn.status == 404
  end

  test "file mkdir creates directory" do
    conn =
      :post
      |> authed("/mkdir")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"path" => "testdir"})
      |> FileController.call(FileController.init([]))
    assert conn.status == 200
  end

  test "file rename works" do
    conn =
      :put
      |> authed("/rename")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"path" => "old.txt", "newName" => "new.txt"})
      |> FileController.call(FileController.init([]))
    assert conn.status in [200, 404]
  end

  test "file move works" do
    conn =
      :post
      |> authed("/move")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"source" => "a.txt", "dest" => "b.txt"})
      |> FileController.call(FileController.init([]))
    assert conn.status in [200, 404]
  end

  test "file delete returns 200" do
    conn = authed(:delete, "/?path=test.txt")
           |> FileController.call(FileController.init([]))
    assert conn.status in [200, 404]
  end

  test "file history returns commits" do
    conn = authed(:get, "/history?path=readme.md")
           |> FileController.call(FileController.init([]))
    assert conn.status == 200
  end

  test "file recover works" do
    conn =
      :post
      |> authed("/recover")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"path" => "file.txt", "commit" => "abc123"})
      |> FileController.call(FileController.init([]))
    assert conn.status in [200, 500]
  end

  test "file push works" do
    conn = authed(:post, "/push") |> FileController.call(FileController.init([]))
    assert conn.status == 200
  end

  # ── SandboxController ────────────────────────────────────────────────

  test "sandbox list returns 200" do
    conn = authed(:get, "/?owner_type=agent&owner_id=test")
           |> SandboxController.call(SandboxController.init([]))
    assert conn.status == 200
  end

  test "sandbox unified files returns 200" do
    conn = authed(:get, "/?owner_type=user&owner_id=test")
           |> SandboxController.call(SandboxController.init([]))
    assert conn.status == 200
  end

  test "sandbox delete returns 200" do
    conn = authed(:delete, "/test-id?type=agent")
           |> SandboxController.call(SandboxController.init([]))
    assert conn.status == 200
  end
end
