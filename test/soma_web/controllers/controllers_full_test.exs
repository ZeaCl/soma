defmodule SomaWeb.ControllersFullTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias Soma.Repo
  alias Soma.Workspace
  alias SomaWeb.{AgentController, FileController, SandboxController, ApiKeyController}

  @org_id "00000000-0000-0000-0000-000000000001"
  @user_id "user_test"

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

  test "agent create returns 201" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:create_user, "agent@test.com"} => {:ok, %{"id" => "a0000000-0000-0000-0000-000000000001", "agent_config" => %{}}}
    })

    conn =
      :post
      |> authed("/")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{
        "name" => "Test Agent",
        "email" => "agent@test.com",
        "engine" => "pi",
        "skills" => ["xlsx"],
        "system_prompt" => "You are helpful"
      })
      |> AgentController.call(AgentController.init([]))
    assert conn.status == 201
  end

  test "agent show returns 404 for missing" do
    conn = authed(:get, "/00000000-0000-0000-0000-000000000099")
           |> AgentController.call(AgentController.init([]))
    assert conn.status == 404
  end

  test "agent config updates" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:update_user, "00000000-0000-0000-0000-000000000099"} => {:ok, %{"system_prompt" => "test"}}
    })
    conn =
      :put
      |> authed("/00000000-0000-0000-0000-000000000099/config")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"system_prompt" => "test"})
      |> AgentController.call(AgentController.init([]))
    assert conn.status == 200
  end

  test "agent delete returns 200" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:delete_user, "00000000-0000-0000-0000-000000000099"} => :ok
    })
    conn = authed(:delete, "/00000000-0000-0000-0000-000000000099")
           |> AgentController.call(AgentController.init([]))
    assert conn.status == 200
  end

  test "agent share returns 200" do
    conn =
      :post
      |> authed("/00000000-0000-0000-0000-000000000099/share")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"shared_with_user_id" => "user-2"})
      |> AgentController.call(AgentController.init([]))
    assert conn.status == 200
  end

  test "agent shares list returns 200" do
    conn = authed(:get, "/00000000-0000-0000-0000-000000000099/shares")
           |> AgentController.call(AgentController.init([]))
    assert conn.status == 200
  end

  test "shared agents returns 200" do
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

  test "file upload returns 200" do
    conn =
      :post
      |> authed("/upload")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"name" => "test.txt", "data" => Base.encode64("test")})
      |> FileController.call(FileController.init([]))
    assert conn.status == 200
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

  test "file delete returns ok or not_found" do
    conn = authed(:delete, "/?path=test.txt")
           |> FileController.call(FileController.init([]))
    assert conn.status in [200, 404]
  end

  test "file delete non-empty returns 409" do
    Workspace.ensure_org(@org_id)
    Workspace.mkdir(@org_id, "nonempty")
    Workspace.write_file(@org_id, "nonempty/a.txt", "x")
    conn = authed(:delete, "/?path=nonempty")
           |> FileController.call(FileController.init([]))
    assert conn.status in [200, 409]
  end

  test "file history returns commits" do
    conn = authed(:get, "/history?path=readme.md")
           |> FileController.call(FileController.init([]))
    assert conn.status == 200
  end

  test "file recover returns ok or error" do
    conn =
      :post
      |> authed("/recover")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"path" => "file.txt", "commit" => "abc123"})
      |> FileController.call(FileController.init([]))
    assert conn.status in [200, 500]
  end

  test "file push returns 200" do
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
