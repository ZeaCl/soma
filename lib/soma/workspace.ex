defmodule Soma.Workspace do
  @moduledoc "Multi-tenant workspace: files + Git tracking per organization."

  @workspace_root Application.compile_env(:soma, :workspace_root, "/home/orgs")

  defp shell, do: Application.get_env(:soma, :shell, Soma.Shell.Real)
  defp fs, do: Application.get_env(:soma, :file_system, Soma.FileSystem.Real)

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

    unless fs().exists?(base) do
      fs().mkdir_p(base)
      init_git(base)
    end

    :ok
  end

  defp init_git(dir) do
    shell().cmd("git", ["init"], cd: dir, stderr_to_stdout: true)
    shell().cmd("git", ["config", "user.email", "soma@zea.local"], cd: dir)
    shell().cmd("git", ["config", "user.name", "Soma Workspace"], cd: dir)
  end

  # ── List (unified: user | agent | org) ──────

  @doc """
  Lista archivos según owner_type:
  - "user" → /home/user-{shortId}/workspace
  - "agent" → /home/soma-{shortId}/workspace
  - "org" → /home/orgs/{org_id}/shared
  """
  def list_files(owner_type, owner_id, org_id, sub_path \\ "") do
    base = workspace_base(owner_type, owner_id, org_id)
    dir = if sub_path == "", do: base, else: Path.join(base, sub_path)

    if fs().dir?(dir) do
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

  # ── Delete (unified) ───────────────────────

  @doc """
  Elimina archivo usando workspace_base (misma base que list_files).
  owner_type: "user" | "agent" | "org"
  """
  def delete_workspace_file(owner_type, owner_id, org_id, relative_path) do
    if empty_path?(relative_path) do
      {:error, :invalid_path}
    else
      base = workspace_base(owner_type, owner_id, org_id)
      full = Path.expand(Path.join(base, relative_path))

      if String.starts_with?(full, base) do
        if fs().exists?(full) do
          do_soft_delete(org_id, full, relative_path)
        else
          {:error, :not_found}
        end
      else
        {:error, :path_traversal}
      end
    end
  end

  defp empty_path?(nil), do: true
  defp empty_path?(""), do: true
  defp empty_path?(_), do: false

  # ── Legacy (backward compat) ─────────────────

  def list_files_per_agent(org_id, agent_id, sub_path \\ "") do
    list_files("agent", agent_id, org_id, sub_path)
  end

  defp scan_dir(root, dir, relative) do
    case fs().ls(dir) do
      {:ok, entries} ->
        entries
        |> Enum.reject(&String.starts_with?(&1, "."))
        |> Enum.sort()
        |> Enum.flat_map(fn name ->
          full = Path.join(dir, name)
          rel = if relative == "", do: name, else: Path.join(relative, name)

          if fs().dir?(full) do
            {:ok, stat} = fs().stat(full)
            [{rel, "dir", stat.size}] ++ scan_dir(root, full, rel)
          else
            {:ok, stat} = fs().stat(full)
            [{rel, "file", stat.size, Path.extname(name)}]
          end
        end)

      _ ->
        []
    end
  end

  # ── Read ─────────────────────────────────────

  def read_file(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path),
         true <- fs().exists?(full) do
      {:ok, fs().read!(full)}
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Write / Upload ────────────────────────────

  def write_file(org_id, relative_path, content) do
    with {:ok, full} <- resolve(org_id, relative_path) do
      dir = Path.dirname(full)
      fs().mkdir_p(dir)
      fs().write(full, content)
      git_commit(org_id, "write: #{relative_path}")
      {:ok, relative_path}
    end
  end

  # ── Mkdir ─────────────────────────────────────

  def mkdir(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path) do
      if fs().exists?(full) do
        {:error, :already_exists}
      else
        fs().mkdir_p(full)
        git_commit(org_id, "mkdir: #{relative_path}")
        {:ok, relative_path}
      end
    end
  end

  # ── Rename ────────────────────────────────────

  def rename(org_id, old_path, new_name) do
    with {:ok, full_old} <- resolve(org_id, old_path),
         true <- fs().exists?(full_old) do
      full_new = Path.join(Path.dirname(full_old), new_name)

      new_relative =
        if Path.dirname(old_path) == ".",
          do: new_name,
          else: Path.join(Path.dirname(old_path), new_name)

      fs().rename(full_old, full_new)
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
         true <- fs().exists?(full_src) do
      fs().mkdir_p(Path.dirname(full_dst))
      fs().rename(full_src, full_dst)
      git_commit(org_id, "move: #{source} -> #{dest}")
      {:ok, dest}
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Delete ────────────────────────────────────

  def delete(org_id, relative_path) do
    if empty_path?(relative_path) do
      {:error, :invalid_path}
    else
      with {:ok, full} <- resolve(org_id, relative_path),
           true <- fs().exists?(full) do
        if fs().dir?(full) and not dir_empty?(full) do
          {:error, :directory_not_empty}
        else
          do_soft_delete(org_id, full, relative_path)
        end
      else
        _ -> {:error, :not_found}
      end
    end
  end

  defp dir_empty?(dir) do
    case fs().ls(dir) do
      {:ok, []} -> true
      {:ok, entries} -> Enum.all?(entries, &String.starts_with?(&1, "."))
      _ -> false
    end
  end

  # ── Soft-delete helper ────────────────────────

  defp do_soft_delete(org_id, full, relative_path) do
    trash_dir = Path.join(org_path(org_id), ".trash")
    fs().mkdir_p(trash_dir)

    timestamp = DateTime.to_unix(DateTime.utc_now(), :millisecond)
    basename = Path.basename(relative_path)
    trash_name = "#{timestamp}_#{basename}"

    # Si el archivo ya existe en trash, agregar sufijo numérico
    trash_path =
      if fs().exists?(Path.join(trash_dir, trash_name)) do
        ext = Path.extname(basename)
        base = Path.rootname(basename)
        Path.join(trash_dir, "#{timestamp}_#{base}_1#{ext}")
      else
        Path.join(trash_dir, trash_name)
      end

    case fs().rename(full, trash_path) do
      :ok ->
        git_commit(org_id, "delete (soft): #{relative_path} -> .trash/#{trash_name}")
        {:ok, relative_path}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Lista archivos en la papelera (.trash/)."
  def list_trash(org_id) do
    trash_dir = Path.join(org_path(org_id), ".trash")

    if fs().dir?(trash_dir) do
      {:ok, scan_dir(trash_dir, trash_dir, "")}
    else
      {:ok, []}
    end
  end

  @doc "Restaura un archivo de la papelera a su ubicación original."
  def recover_from_trash(org_id, trash_filename, target_path) do
    trash_dir = Path.join(org_path(org_id), ".trash")
    trash_full = Path.join(trash_dir, trash_filename)

    with {:ok, target_full} <- resolve(org_id, target_path),
         true <- fs().exists?(trash_full) do
      # Asegurar que el directorio destino existe
      target_dir = Path.dirname(target_full)
      fs().mkdir_p(target_dir)

      case fs().rename(trash_full, target_full) do
        :ok ->
          git_commit(org_id, "recover: #{target_path} from trash")
          {:ok, target_path}

        {:error, reason} ->
          {:error, reason}
      end
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Git ────────────────────────────────────────

  def history(org_id, relative_path) do
    base = org_path(org_id)

    case shell().cmd("git", ["log", "--oneline", "-10", "--follow", "--", relative_path],
           cd: base,
           stderr_to_stdout: true
         ) do
      {output, 0} ->
        commits =
          output
          |> String.trim()
          |> String.split("\n")
          |> Enum.reject(&(&1 == ""))
          |> Enum.map(fn line ->
            [hash | msg] = String.split(line, " ")
            %{hash: hash, message: Enum.join(msg, " ")}
          end)

        {:ok, commits}

      {_, _} ->
        {:ok, []}
    end
  end

  def recover(org_id, relative_path, commit_hash) do
    base = org_path(org_id)

    case shell().cmd("git", ["checkout", commit_hash, "--", relative_path],
           cd: base,
           stderr_to_stdout: true
         ) do
      {_, 0} ->
        git_commit(org_id, "recover: #{relative_path} @ #{String.slice(commit_hash, 0, 7)}")
        {:ok, relative_path}

      {error, _} ->
        {:error, error}
    end
  end

  def push(org_id) do
    base = org_path(org_id)

    case shell().cmd("git", ["push", "origin", "main"], cd: base, stderr_to_stdout: true) do
      {output, 0} -> {:ok, String.slice(output, 0, 500)}
      {error, _} -> {:ok, :not_configured}
    end
  end

  defp git_commit(org_id, message) do
    base = org_path(org_id)
    shell().cmd("git", ["add", "-A"], cd: base, stderr_to_stdout: true)
    shell().cmd("git", ["commit", "-m", message], cd: base, stderr_to_stdout: true)
  end
end
