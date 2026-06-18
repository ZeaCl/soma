defmodule Soma.OrgWorkspace do
  @moduledoc """
  Workspace compartido por organización.

  Usa grupos Linux para control de acceso:
  - /workspace/orgs/{orgId}/shared/ → grupo org-{orgId}, chmod 2770
  - /workspace/orgs/{orgId}/teams/{teamId}/ → grupo team-{teamId}, chmod 2770

  El setgid bit (g+s) asegura que archivos nuevos hereden el grupo.
  """

  @workspace_root Application.compile_env(:soma, :org_workspace_root, "/workspace/orgs")

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

    unless File.exists?(dir) do
      File.mkdir_p!(dir)
      _ = System.cmd("chgrp", [group, dir], stderr_to_stdout: true)
      File.chmod!(dir, 0o2770)
    end
    :ok
  end

  def ensure_team(org_id, team_id) do
    dir = team_dir(org_id, team_id)
    group = "team-#{team_id}"

    unless File.exists?(dir) do
      File.mkdir_p!(dir)
      _ = System.cmd("chgrp", [group, dir], stderr_to_stdout: true)
      File.chmod!(dir, 0o2770)
    end
    :ok
  end

  # ── List ─────────────────────────────────────────────────────

  def list_files(org_id, sub_path \\ "") do
    base = org_base(org_id)
    dir = if sub_path == "", do: base, else: Path.join(base, sub_path)

    if File.dir?(dir) do
      {:ok, scan_dir(dir, dir, "")}
    else
      {:ok, []}
    end
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
            [{rel, "dir", File.stat!(full).size} | scan_dir(root, full, rel)]
          else
            [{rel, "file", File.stat!(full).size, Path.extname(name)}]
          end
        end)
      _ -> []
    end
  end

  # ── Read ─────────────────────────────────────────────────────

  def read_file(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path),
         true <- File.exists?(full) do
      {:ok, File.read!(full)}
    else
      _ -> {:error, :not_found}
    end
  end

  # ── Write ─────────────────────────────────────────────────────

  def write_file(org_id, relative_path, content) do
    with {:ok, full} <- resolve(org_id, relative_path) do
      dir = Path.dirname(full)
      File.mkdir_p!(dir)
      File.write!(full, content)
      {:ok, relative_path}
    end
  end

  # ── Mkdir ─────────────────────────────────────────────────────

  def mkdir(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path) do
      if File.exists?(full) do
        {:error, :already_exists}
      else
        File.mkdir_p!(full)
        {:ok, relative_path}
      end
    end
  end

  # ── Delete ────────────────────────────────────────────────────

  def delete(org_id, relative_path) do
    with {:ok, full} <- resolve(org_id, relative_path),
         true <- File.exists?(full) do
      result =
        if File.dir?(full) do
          case File.ls(full) do
            {:ok, []} -> File.rmdir!(full); :ok
            _ -> :directory_not_empty
          end
        else
          File.rm!(full)
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
         true <- File.exists?(full_src) do
      File.mkdir_p!(Path.dirname(full_dst))
      File.rename!(full_src, full_dst)
      {:ok, dest}
    else
      _ -> {:error, :not_found}
    end
  end
end
