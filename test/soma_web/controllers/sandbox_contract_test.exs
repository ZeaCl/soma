defmodule SomaWeb.SandboxContractTest do
  @moduledoc """
  Contract tests para el endpoint /files/unified usado por zea-soma CLI.

  Valida que cada combinación de parámetros que el CLI envía tenga la
  respuesta esperada. Si estos tests fallan, el CLI probablemente también.

  Comandos del CLI cubiertos:
    - files list        → GET /files/unified?owner_type=org
    - files list --agent → GET /files/unified?owner_type=agent&owner_id=...
    - files list --user  → GET /files/unified?owner_type=user&owner_id=...
    - sandbox files      → GET /files/unified?owner_type=user&owner_id=...
    - files upload       → POST /files/unified/upload
    - files delete (sandbox) → DELETE /files/unified/delete
  """
  use ExUnit.Case, async: false
  use Plug.Test

  alias Soma.Repo
  alias Soma.Workspace
  alias SomaWeb.SandboxController

  @org_id "00000000-0000-0000-0000-000000000001"
  @user_id "user_test"
  @agent_id "agent-test-001"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Workspace.ensure_org(@org_id)
    Application.put_env(:soma, :shell, Soma.Shell.Mock)
    Soma.Shell.Mock.start_link(%{})
    on_exit(fn -> Application.delete_env(:soma, :shell) end)
  end

  defp authed(method, path) do
    conn(method, path)
    |> assign(:org_id, @org_id)
    |> assign(:user_id, @user_id)
    |> assign(:authenticated, true)
  end

  # ── files list (CLI: zea-soma files list) ────────────────────────────

  describe "GET / — contrato files list" do
    test "owner_type=org sin owner_id → 200 (issue #175)" do
      conn =
        authed(:get, "/?owner_type=org")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert Map.has_key?(body, "files")
      assert is_list(body["files"])
      assert body["owner_type"] == "org"
    end

    test "owner_type=org con path → 200" do
      conn =
        authed(:get, "/?owner_type=org&path=shared")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert is_list(body["files"])
    end

    test "owner_type=agent con owner_id → 200" do
      conn =
        authed(:get, "/?owner_type=agent&owner_id=#{@agent_id}")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert is_list(body["files"])
      assert body["owner_id"] == @agent_id
    end

    test "owner_type=user con owner_id → 200" do
      conn =
        authed(:get, "/?owner_type=user&owner_id=test-user-1")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert is_list(body["files"])
    end

    test "owner_type=agent sin owner_id → 400 (falta owner_id)" do
      conn =
        authed(:get, "/?owner_type=agent")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 400
      body = Jason.decode!(conn.resp_body)
      assert body["error"] == "owner_id required"
    end

    test "owner_type=user sin owner_id → 400 (falta owner_id)" do
      conn =
        authed(:get, "/?owner_type=user")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 400
      body = Jason.decode!(conn.resp_body)
      assert body["error"] == "owner_id required"
    end

    test "sin owner_type usa default agent y exige owner_id → 400" do
      conn =
        authed(:get, "/")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 400
      body = Jason.decode!(conn.resp_body)
      assert body["error"] == "owner_id required"
    end

    test "cada file en la lista tiene name y type" do
      # Escribir un archivo para que la lista no esté vacía
      Workspace.write_file(@org_id, "test.txt", "content")

      conn =
        authed(:get, "/?owner_type=org")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)

      for f <- body["files"] do
        assert Map.has_key?(f, "name")
        assert Map.has_key?(f, "type")
        assert f["type"] in ["file", "dir"]
      end
    end
  end

  # ── GET /list — alias explícito (issue #175) ─────────────────────────

  describe "GET /list — alias para files list" do
    test "GET /list?owner_type=org → 200 (mismo contrato que GET /)" do
      conn =
        authed(:get, "/list?owner_type=org")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert Map.has_key?(body, "files")
      assert is_list(body["files"])
    end

    test "GET /list?owner_type=agent sin owner_id → 400" do
      conn =
        authed(:get, "/list?owner_type=agent")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 400
      body = Jason.decode!(conn.resp_body)
      assert body["error"] == "owner_id required"
    end

    test "GET /list?owner_type=agent&owner_id=xxx → 200" do
      conn =
        authed(:get, "/list?owner_type=agent&owner_id=#{@agent_id}")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert is_list(body["files"])
    end
  end

  # ── upload (CLI: zea-soma files upload) ──────────────────────────────

  describe "POST /upload — contrato files upload" do
    test "upload archivo → 200 con body.ok=true, path y size" do
      conn =
        :post
        |> authed("/upload")
        |> put_req_header("content-type", "application/json")
        |> Map.put(:body_params, %{
          "owner_type" => "org",
          "name" => "upload-test.txt",
          "data" => Base.encode64("hello contract")
        })
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert body["ok"] == true
      assert body["path"] =~ "upload-test.txt"
      assert is_integer(body["size"])
    end

    test "upload con subpath → 200" do
      conn =
        :post
        |> authed("/upload")
        |> put_req_header("content-type", "application/json")
        |> Map.put(:body_params, %{
          "owner_type" => "org",
          "name" => "nested.txt",
          "data" => Base.encode64("nested"),
          "path" => "subdir"
        })
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert body["ok"] == true
    end
  end

  # ── delete (CLI sandbox files delete) ────────────────────────────────

  describe "DELETE /delete — contrato files delete" do
    test "delete archivo existente → 200" do
      # Crear archivo en shared/
      shared = Path.join(Workspace.org_path(@org_id), "shared")
      File.mkdir_p!(shared)
      File.write!(Path.join(shared, "to_delete.txt"), "bye")

      conn =
        authed(:delete, "/delete?owner_type=org&path=to_delete.txt")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert body["ok"] == true
      refute File.exists?(Path.join(shared, "to_delete.txt"))
    end

    test "delete archivo inexistente → 404" do
      conn =
        authed(:delete, "/delete?owner_type=org&path=does_not_exist.txt")
        |> SandboxController.call(SandboxController.init([]))

      assert conn.status == 404
      body = Jason.decode!(conn.resp_body)
      assert body["error"] == "not_found"
    end
  end
end
