defmodule Soma.Workspace do
  @moduledoc "Multi-tenant workspace: files + Git tracking per organization."

  @workspace_root Application.compile_env(:soma, :workspace_root, "/workspace/orgs")

  # ── Path resolution ──────────────────────────

  def org_path(org_id), do: Path.join(@workspace_root, org_id)
  def app_path(org_id, app), do: Path.join([@workspace_root, org_id, app])

  def resolve(org_id, relative_path) do
    base = org_path(org_id)
    full = Path.expand(Path.join(base, relative_path))
    if String.starts_with?(full, base), do: {:ok, full}, else: {:error, :path_traversal}
  end

  # ── Init ─────────────────────────────────────

  def ensure_org(org_id) do
    base = org_path(org_id)
    unless File.exists?(base) do
      File.mkdir_p!(base)
      init_git(base)
    end
    :ok
  end

  defp init_git(dir) do
    System.cmd("git", ["init"], cd: dir, stderr_to_stdout: true)
    System.cmd("git", ["config", "user.email", "soma@zea.local"], cd: dir)
    System.cmd("git", ["config", "user.name", "Soma Workspace"], cd: dir)
  end

  # ── List (unified: user | agent | org) ──────

  @doc """
  Lista archivos según owner_type:
  - "user" → /home/user-{shortId}/workspace
  - "agent" → /home/soma-{shortId}/workspace
  - "org" → /workspace/orgs/{org_id}/shared
  """
  def list_files(owner_type, owner_id, org_id, sub_path \\ "") do
    base = workspace_base(owner_type, owner_id, org_id)
    dir = if sub_path == "", do: base, else: Path.join(base, sub_path)
    if File.dir?(dir) do
      {:ok, scan_dir(dir, dir, "")}
    else
      {:ok, []}
    end
  end

  defp workspace_base("agent", agent_id, _org_id) do
    username = "soma-#{String.slice(agent_id, 0, 12)}"
    "/home/#{username}/workspace"
  end

  defp workspace_base("user", user_id, _org_id) do
    username = "user-#{String.slice(user_id, 0, 12)}"
    "/home/#{username}/workspace"
  end

  defp workspace_base("org", _owner_id, org_id) do
    Path.join([@workspace_root, org_id, "shared"])
  end

  defp workspace_base(_, _, org_id) do
    org_path(org_id)
  end

  # ── Legacy (backward compat) ─────────────────

  def list_files_per_agent(org_id, agent_id, sub_path \\ "") do
    list_files("agent", agent_id, org_id, sub_path)
  end

  defp scan_dir(root, dir, relative) do
    case File.ls(dir) do
      {:ok, entries} ->
        entries
        |> Enum.reject(&String.starts_with?(&1, "."))
        |> Enum.sort()
        |> Enum.flat_map(fn name ->
          full = Path.join(dir, name)
          rel = if relative == "", do: name, else: Path.join(relative, name)
          if File.dir?(full) do
            [{rel, "dir", File.stat!(full).size}] ++ scan_dir(root, full, rel)
          else
            [{rel, "file", File.stat!(full).size, Path.extname(name)}]
          end
        end)
      _ -> []
    end
  end

  # ── Read ─────────────────────────────────────

  def read_file(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path),
         true <- File.exists?(full) do
      {:ok, File.read!(full)}
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Write / Upload ────────────────────────────

  def write_file(org_id, relative_path, content) do
    with {:ok, full} <- resolve(org_id, relative_path) do
      dir = Path.dirname(full)
      File.mkdir_p!(dir)
      File.write!(full, content)
      git_commit(org_id, "write: #{relative_path}")
      {:ok, relative_path}
    end
  end

  # ── Mkdir ─────────────────────────────────────

  def mkdir(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path) do
      if File.exists?(full) do
        {:error, :already_exists}
      else
        File.mkdir_p!(full)
        git_commit(org_id, "mkdir: #{relative_path}")
        {:ok, relative_path}
      end
    end
  end

  # ── Rename ────────────────────────────────────

  def rename(org_id, old_path, new_name) do
    with {:ok, full_old} <- resolve(org_id, old_path),
         true <- File.exists?(full_old) do
      full_new = Path.join(Path.dirname(full_old), new_name)
      new_relative = if Path.dirname(old_path) == ".", do: new_name, else: Path.join(Path.dirname(old_path), new_name)
      File.rename!(full_old, full_new)
      git_commit(org_id, "rename: #{old_path} -> #{new_name}")
      {:ok, new_relative}
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Move ──────────────────────────────────────

  def move(org_id, source, dest) do
    with {:ok, full_src} <- resolve(org_id, source),
         {:ok, full_dst} <- resolve(org_id, dest),
         true <- File.exists?(full_src) do
      File.mkdir_p!(Path.dirname(full_dst))
      File.rename!(full_src, full_dst)
      git_commit(org_id, "move: #{source} -> #{dest}")
      {:ok, dest}
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Delete ────────────────────────────────────

  def delete(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path),
         true <- File.exists?(full) do
      result =
        if File.dir?(full) do
          case File.ls(full) do
            {:ok, []} ->
              File.rmdir!(full)
              :ok
            _ -> :directory_not_empty
          end
        else
          File.rm!(full)
          :ok
        end

      case result do
        :ok ->
          git_commit(org_id, "delete: #{relative_path}")
          {:ok, relative_path}
        :directory_not_empty ->
          {:error, :directory_not_empty}
      end
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Git ────────────────────────────────────────

  def history(org_id, relative_path) do
    base = org_path(org_id)
    case System.cmd("git", ["log", "--oneline", "-10", "--follow", "--", relative_path],
                    cd: base, stderr_to_stdout: true) do
      {output, 0} ->
        commits = output
          |> String.trim()
          |> String.split("\n")
          |> Enum.reject(&(&1 == ""))
          |> Enum.map(fn line ->
            [hash | msg] = String.split(line, " ")
            %{hash: hash, message: Enum.join(msg, " ")}
          end)
        {:ok, commits}
      {_, _} -> {:ok, []}
    end
  end

  def recover(org_id, relative_path, commit_hash) do
    base = org_path(org_id)
    case System.cmd("git", ["checkout", commit_hash, "--", relative_path],
                    cd: base, stderr_to_stdout: true) do
      {_, 0} ->
        git_commit(org_id, "recover: #{relative_path} @ #{String.slice(commit_hash, 0, 7)}")
        {:ok, relative_path}
      {error, _} -> {:error, error}
    end
  end

  def push(org_id) do
    base = org_path(org_id)
    case System.cmd("git", ["push", "origin", "main"],
                    cd: base, stderr_to_stdout: true) do
      {output, 0} -> {:ok, String.slice(output, 0, 500)}
      {error, _} -> {:ok, :not_configured}
    end
  end

  defp git_commit(org_id, message) do
    base = org_path(org_id)
    System.cmd("git", ["add", "-A"], cd: base, stderr_to_stdout: true)
    System.cmd("git", ["commit", "-m", message], cd: base, stderr_to_stdout: true)
  end
end
