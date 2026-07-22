defmodule Soma.UserSandboxTest do
  use ExUnit.Case, async: false

  alias Soma.UserSandbox

  @id "00000000-0000-0000-0000-000000000001"
  @org "org-000000000001"

  setup do
    Application.put_env(:soma, :shell, Soma.Shell.Mock)
    Soma.Shell.Mock.start_link(%{})

    on_exit(fn ->
      Application.delete_env(:soma, :shell)
    end)
  end

  test "username generates correct Linux username" do
    assert UserSandbox.username(@id) == "user-00000000-000"
  end

  test "home_dir returns correct path" do
    assert UserSandbox.home_dir(@id) == "/home/user-00000000-000"
  end

  test "create successful returns uid and home" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-user-useradd", [@id, @org, ""]} => {"", 0},
      {"id", ["-u", "user-00000000-000"]} => {"1002\n", 0}
    })

    assert {:ok, 1002, "/home/user-00000000-000"} =
             UserSandbox.create(@id, @org)
  end

  test "create with teams passes args correctly" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-user-useradd", [@id, @org, "team-a,team-b"]} => {"", 0},
      {"id", ["-u", "user-00000000-000"]} => {"1002\n", 0}
    })

    assert {:ok, 1002, _} = UserSandbox.create(@id, @org, teams: "team-a,team-b")
  end

  test "create fails when script returns error" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-user-useradd", [@id, @org, ""]} => {"Permission denied", 1}
    })

    assert {:error, reason} = UserSandbox.create(@id, @org)
    assert reason =~ "useradd failed"
  end

  test "destroy successful" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-user-userdel", [@id]} => {"", 0}
    })

    assert {:ok, @id} = UserSandbox.destroy(@id)
  end

  test "destroy fails when script returns error" do
    Soma.Shell.Mock.set_responses(%{
      {"/usr/local/bin/soma-user-userdel", [@id]} => {"not found", 1}
    })

    assert {:error, reason} = UserSandbox.destroy(@id)
    assert reason =~ "userdel failed"
  end
end
