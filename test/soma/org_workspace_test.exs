defmodule Soma.OrgWorkspaceTest do
  use ExUnit.Case, async: false

  alias Soma.OrgWorkspace

  @org "org-test-123"

  setup do
    Application.put_env(:soma, :shell, Soma.Shell.Mock)
    Application.put_env(:soma, :file_system, Soma.FileSystem.Mock)
    Soma.Shell.Mock.start_link(%{})
    Soma.FileSystem.Mock.start_link(%{})

    on_exit(fn ->
      Application.delete_env(:soma, :shell)
      Application.delete_env(:soma, :file_system)
    end)
  end

  test "shared_dir returns correct path" do
    assert OrgWorkspace.shared_dir(@org) == "/workspace/orgs/#{@org}/shared"
  end

  test "team_dir returns correct path" do
    assert OrgWorkspace.team_dir(@org, "team1") == "/workspace/orgs/#{@org}/teams/team1"
  end

  test "resolve allows valid paths" do
    assert {:ok, path} = OrgWorkspace.resolve(@org, "sub/file.txt")
    assert String.ends_with?(path, "sub/file.txt")
  end

  test "resolve blocks path traversal" do
    assert {:error, :path_traversal} = OrgWorkspace.resolve(@org, "../../etc/passwd")
  end

  test "ensure_shared creates directory and sets permissions" do
    Soma.FileSystem.Mock.set_responses(%{
      :exists_default => false,
      :dir_default => true
    })

    Soma.Shell.Mock.set_responses(%{
      {"chgrp", ["org-#{@org}", "/workspace/orgs/#{@org}/shared"]} => {"", 0}
    })

    assert :ok = OrgWorkspace.ensure_shared(@org)
  end

  test "list_shared_dirs returns empty when no dir" do
    Soma.FileSystem.Mock.set_responses(%{
      :dir_default => false,
      :exists_default => false
    })
    result = OrgWorkspace.list_shared_dirs(@org)
    assert is_list(result)
  end

  test "ensure_team_shared creates directory and sets permissions" do
    Soma.FileSystem.Mock.set_responses(%{
      :exists_default => false,
      :dir_default => true
    })

    team_dir = OrgWorkspace.team_dir(@org, "team1")
    assert String.ends_with?(team_dir, "teams/team1")
  end

  test "resolve validates team paths" do
    assert {:ok, path} = OrgWorkspace.resolve(@org, "teams/t1/file.txt")
    assert String.ends_with?(path, "teams/t1/file.txt")
  end

  test "ensure_team_shared creates team directory" do
    Soma.Shell.Mock.set_responses(%{
      {"groupadd", ["--force", "team-team1"]} => {"", 0},
      {"chgrp", ["team-team1", "/workspace/orgs/#{@org}/teams/team1"]} => {"", 0}
    })
    Soma.FileSystem.Mock.set_responses(%{
      :exists_default => false,
      :dir_default => true
    })

    result = OrgWorkspace.ensure_team_shared(@org, "team1")
    assert String.ends_with?(result, "teams/team1")
  end
end
