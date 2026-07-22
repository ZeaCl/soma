defmodule Soma.OrgWorkspace do
  @moduledoc """
  Workspace compartido por organización — grupos Linux para control de acceso.
  """

  @workspace_root Application.compile_env(:soma, :org_workspace_root, "/workspace/orgs")

  defp shell, do: Application.get_env(:soma, :shell, Soma.Shell.Real)
  defp fs, do: Application.get_env(:soma, :file_system, Soma.FileSystem.Real)

  # ── Path resolution ──────────────────────────────────────────

  defp org_base(org_id), do: Path.join(@workspace_root, org_id)

  def shared_dir(org_id), do: Path.join([@workspace_root, org_id, "shared"])
  def team_dir(org_id, team_id), do: Path.join([@workspace_root, org_id, "teams", team_id])

  def resolve(org_id, relative_path) do
    base = org_base(org_id)
    full = Path.expand(Path.join(base, relative_path))
    if String.starts_with?(full, base), do: {:ok, full}, else: {:error, :path_traversal}
  end

  # ── Init ─────────────────────────────────────────────────────

  def ensure_shared(org_id) do
    dir = shared_dir(org_id)
    group = "org-#{org_id}"

    unless fs().exists?(dir) do
      fs().mkdir_p(dir)
      _ = shell().cmd("chgrp", [group, dir], stderr_to_stdout: true)
      fs().chmod!(dir, 0o2770)
    end

    :ok
  end

  def ensure_team(org_id, team_id) do
    dir = team_dir(org_id, team_id)
    group = "team-#{team_id}"

    unless fs().exists?(dir) do
      fs().mkdir_p(dir)
      _ = shell().cmd("chgrp", [group, dir], stderr_to_stdout: true)
      fs().chmod!(dir, 0o2770)
    end

    :ok
  end

  # ── List ─────────────────────────────────────────────────────

  def list_files(org_id, sub_path \\ "") do
    base = org_base(org_id)
    dir = if sub_path == "", do: base, else: Path.join(base, sub_path)

    if fs().dir?(dir) do
      {:ok, scan_dir(dir, dir, "")}
    else
      {:ok, []}
    end
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
            [{rel, "dir", fs().stat(full).size} | scan_dir(root, full, rel)]
          else
            [{rel, "file", fs().stat(full).size, Path.extname(name)}]
          end
        end)

      _ ->
        []
    end
  end

  # ── Read ─────────────────────────────────────────────────────

  def read_file(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path),
         true <- fs().exists?(full) do
      {:ok, fs().read!(full)}
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Write ─────────────────────────────────────────────────────

  def write_file(org_id, relative_path, content) do
    with {:ok, full} <- resolve(org_id, relative_path) do
      dir = Path.dirname(full)
      fs().mkdir_p(dir)
      fs().write(full, content)
      {:ok, relative_path}
    end
  end

  # ── Mkdir ─────────────────────────────────────────────────────

  def mkdir(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path) do
      if fs().exists?(full) do
        {:error, :already_exists}
      else
        fs().mkdir_p(full)
        {:ok, relative_path}
      end
    end
  end

  # ── Delete ────────────────────────────────────────────────────

  def delete(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path),
         true <- fs().exists?(full) do
      result =
        if fs().dir?(full) do
          case fs().ls(full) do
            {:ok, []} ->
              fs().rmdir(full)
              :ok

            _ ->
              :directory_not_empty
          end
        else
          fs().rm!(full)
          :ok
        end

      case result do
        :ok -> {:ok, relative_path}
        :directory_not_empty -> {:error, :directory_not_empty}
      end
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Move / Rename ─────────────────────────────────────────────

  def move(org_id, source, dest) do
    with {:ok, full_src} <- resolve(org_id, source),
         {:ok, full_dst} <- resolve(org_id, dest),
         true <- fs().exists?(full_src) do
      fs().mkdir_p(Path.dirname(full_dst))
      fs().rename!(full_src, full_dst)
      {:ok, dest}
    else
      _ -> {:error, :not_found}
    end
  end
end
