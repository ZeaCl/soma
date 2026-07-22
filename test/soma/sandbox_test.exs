defmodule Soma.SandboxTest do
  use ExUnit.Case, async: true

  alias Soma.Sandbox

  @agent "00000000-0000-0000-0000-0000000000a1"
  @org "00000000-0000-0000-0000-000000000001"

  setup do
    Application.put_env(:soma, :shell, Soma.Shell.Mock)
    Soma.Shell.Mock.start_link(%{})

    on_exit(fn ->
      Application.delete_env(:soma, :shell)
    end)

    :ok
  end

  # ── username/1 ───────────────────────────────────────────────────────

  test "username genera nombre Linux correcto" do
    assert Sandbox.username(@agent) == "soma-00000000-000"
  end

  # ── home_dir/1 ───────────────────────────────────────────────────────

  test "home_dir devuelve ruta correcta" do
    assert Sandbox.home_dir(@agent) == "/home/soma-00000000-000"
  end

  test "home_dir es consistente con username" do
    username = Sandbox.username(@agent)
    home = Sandbox.home_dir(@agent)
    assert home == "/home/#{username}"
  end

  # ── create/3 ─────────────────────────────────────────────────────────

  test "create exitoso retorna uid y home" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-agent-useradd", [@agent, @org, "", "[]"]} => {"", 0},
      {"id", ["-u", "soma-00000000-000"]} => {"1001\n", 0}
    })

    assert {:ok, 1001, "/home/soma-00000000-000"} =
             Sandbox.create(@agent, @org)
  end

  test "create con teams y mounts pasa args correctos" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-agent-useradd",
       [@agent, @org, "finanzas", ~s([{"source":"/tmp","dest":"shared"}])]} =>
        {"", 0},
      {"id", ["-u", "soma-00000000-000"]} => {"1001\n", 0}
    })

    assert {:ok, 1001, _} =
             Sandbox.create(@agent, @org,
               teams: "finanzas",
               mounts: [%{source: "/tmp", dest: "shared"}]
             )
  end

  test "create falla cuando script devuelve error" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-agent-useradd", [@agent, @org, "", "[]"]} =>
        {"Permission denied", 1}
    })

    assert {:error, reason} = Sandbox.create(@agent, @org)
    assert reason =~ "useradd failed"
  end

  test "create maneja uid faltante" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-agent-useradd", [@agent, @org, "", "[]"]} => {"", 0},
      {"id", ["-u", "soma-00000000-000"]} => {"no such user", 1}
    })

    assert {:ok, nil, "/home/soma-00000000-000"} =
             Sandbox.create(@agent, @org)
  end

  # ── destroy/1 ────────────────────────────────────────────────────────

  test "destroy exitoso" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-agent-userdel", [@agent]} => {"", 0}
    })

    assert {:ok, @agent} = Sandbox.destroy(@agent)
  end

  test "destroy falla cuando script devuelve error" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-agent-userdel", [@agent]} => {"not found", 1}
    })

    assert {:error, reason} = Sandbox.destroy(@agent)
    assert reason =~ "userdel failed"
  end
end
