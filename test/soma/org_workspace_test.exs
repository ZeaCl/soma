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
    Soma.FileSystem.Mock.set_responses(%{:exists_default => false, :dir_default => true})
    Soma.Shell.Mock.set_responses(%{
      {"chgrp", ["org-#{@org}", "/workspace/orgs/#{@org}/shared"]} => {"", 0}
    })
    assert :ok = OrgWorkspace.ensure_shared(@org)
  end

  test "ensure_team creates team directory" do
    Soma.FileSystem.Mock.set_responses(%{:exists_default => false, :dir_default => true})
    Soma.Shell.Mock.set_responses(%{
      {"groupadd", ["--force", "team-team1"]} => {"", 0},
      {"chgrp", ["team-team1", "/workspace/orgs/#{@org}/teams/team1"]} => {"", 0}
    })
    result = OrgWorkspace.ensure_team(@org, "team1")
    assert String.ends_with?(result, "teams/team1")
  end

  test "list_files returns files" do
    Soma.FileSystem.Mock.set_responses(%{:dir_default => true, :exists_default => true})
    {:ok, files} = OrgWorkspace.list_files(@org)
    assert is_list(files)
  end

  test "read_file returns content" do
    Soma.FileSystem.Mock.set_responses(%{
      :exists_default => true,
      {:read!, "/workspace/orgs/#{@org}/readme.md"} => "hello"
    })
    assert {:ok, "hello"} = OrgWorkspace.read_file(@org, "readme.md")
  end

  test "mkdir creates directory" do
    Soma.FileSystem.Mock.set_responses(%{:exists_default => false, :dir_default => true})
    assert {:ok, _} = OrgWorkspace.mkdir(@org, "newdir")
  end

  test "write_file creates file" do
    Soma.FileSystem.Mock.set_responses(%{:exists_default => true, :dir_default => true})
    assert {:ok, "file.txt"} = OrgWorkspace.write_file(@org, "file.txt", "content")
  end

  test "delete removes file" do
    Soma.FileSystem.Mock.set_responses(%{:exists_default => true, :dir_default => true})
    assert {:ok, _} = OrgWorkspace.delete(@org, "old.txt")
  end

  test "move renames file" do
    Soma.FileSystem.Mock.set_responses(%{:exists_default => true, :dir_default => true})
    assert {:ok, "dst.txt"} = OrgWorkspace.move(@org, "src.txt", "dst.txt")
  end
end
