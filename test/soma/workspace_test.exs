defmodule Soma.WorkspaceTest do
  use ExUnit.Case, async: false

  alias Soma.Workspace

  @org "test-org-workspace"

  setup do
    base = "/tmp/soma-test-workspace/#{@org}"
    if File.exists?(base), do: File.rm_rf!(base)
    Workspace.ensure_org(@org)
    on_exit(fn -> File.rm_rf!("/tmp/soma-test-workspace") end)
    :ok
  end

  test "ensure_org creates directory and initializes git" do
    base = Workspace.org_path(@org)
    assert File.dir?(base)
    assert File.dir?(Path.join(base, ".git"))
  end

  test "write and read file" do
    assert {:ok, "hello.md"} = Workspace.write_file(@org, "hello.md", "Hello World")
    assert {:ok, "Hello World"} = Workspace.read_file(@org, "hello.md")
  end

  test "mkdir creates directory" do
    assert {:ok, "docs"} = Workspace.mkdir(@org, "docs")
    assert File.dir?(Path.join(Workspace.org_path(@org), "docs"))
  end

  test "mkdir rejects duplicates" do
    Workspace.mkdir(@org, "data")
    assert {:error, :already_exists} = Workspace.mkdir(@org, "data")
  end

  test "rename file" do
    Workspace.write_file(@org, "old.txt", "content")
    assert {:ok, "new.txt"} = Workspace.rename(@org, "old.txt", "new.txt")
    assert {:error, :not_found} = Workspace.read_file(@org, "old.txt")
    assert {:ok, "content"} = Workspace.read_file(@org, "new.txt")
  end

  test "move file to subdirectory" do
    Workspace.mkdir(@org, "sub")
    Workspace.write_file(@org, "file.txt", "data")
    assert {:ok, "sub/file.txt"} = Workspace.move(@org, "file.txt", "sub/file.txt")
    assert {:ok, "data"} = Workspace.read_file(@org, "sub/file.txt")
  end

  test "delete file" do
    Workspace.write_file(@org, "temp.txt", "x")
    assert {:ok, _} = Workspace.delete(@org, "temp.txt")
    assert {:error, :not_found} = Workspace.read_file(@org, "temp.txt")
  end

  test "delete non-empty directory fails" do
    Workspace.mkdir(@org, "full-dir")
    Workspace.write_file(@org, "full-dir/a.txt", "x")
    assert {:error, :directory_not_empty} = Workspace.delete(@org, "full-dir")
  end

  test "path traversal blocked" do
    assert {:error, :path_traversal} = Workspace.resolve(@org, "../../etc/passwd")
    assert {:error, :path_traversal} = Workspace.resolve(@org, "../other-org/secrets")
  end

  test "list files returns tree" do
    Workspace.mkdir(@org, "docs")
    Workspace.write_file(@org, "readme.md", "hello")
    Workspace.write_file(@org, "docs/guide.md", "guide")

    base = Workspace.org_path(@org)
    assert File.dir?(Path.join(base, "docs"))
    assert File.exists?(Path.join(base, "readme.md"))
    assert File.exists?(Path.join(base, "docs/guide.md"))
  end

  test "git history after operations" do
    Workspace.write_file(@org, "changelog.md", "v1")
    Workspace.write_file(@org, "changelog.md", "v2")
    {:ok, commits} = Workspace.history(@org, "changelog.md")
    assert length(commits) >= 2
  end

  test "recover file to previous version" do
    Workspace.write_file(@org, "recover.md", "v1")
    Workspace.write_file(@org, "recover.md", "v2")
    {:ok, commits} = Workspace.history(@org, "recover.md")
    # commits are newest first, so last commit is v1
    last_commit = List.last(commits)
    assert {:ok, "recover.md"} = Workspace.recover(@org, "recover.md", last_commit.hash)
    assert {:ok, "v1"} = Workspace.read_file(@org, "recover.md")
  end

  test "app_path returns correct path" do
    path = Workspace.app_path(@org, "myapp")
    assert String.ends_with?(path, "test-org-workspace/myapp")
  end

  test "push returns not_configured when no remote" do
    assert {:ok, :not_configured} = Workspace.push(@org)
  end
end
