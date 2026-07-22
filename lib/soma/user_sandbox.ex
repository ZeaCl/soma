defmodule Soma.UserSandbox do
  @moduledoc """
  OS-level sandbox management para usuarios humanos.

  Cada usuario humano recibe un usuario Linux real con:
  - Home aislado (chmod 700): /home/user-{shortId}/
  - Workspace personal: ~/workspace/
  - Grupo de organización: org-{orgId}
  - Acceso a directorios compartidos de la org

  A diferencia de Soma.Sandbox (agentes):
  - Username: user-{shortId} (no soma-{shortId})
  - Sin skills (no ejecutan pi)
  """

  @scripts_dir Application.compile_env(:soma, :scripts_dir, "/usr/local/bin")

  @doc """
  Crea un usuario Linux para un humano.

  Returns `{:ok, uid, home}` on success, `{:error, reason}` on failure.
  """
  def create(user_id, org_id, opts \\ []) do
    script = Path.join(@scripts_dir, "soma-user-useradd")
    teams = Keyword.get(opts, :teams, "") || ""
    args = [user_id, org_id, teams]

    case System.cmd(script, args, stderr_to_stdout: true) do
      {_output, 0} ->
        username = "user-#{String.slice(user_id, 0, 12)}"
        home = "/home/#{username}"
        uid = extract_uid_from_username(username)
        {:ok, uid, home}

      {output, code} ->
        {:error, "useradd failed (exit #{code}): #{String.slice(output, 0, 200)}"}
    end
  end

  @doc """
  Destruye el usuario Linux.
  """
  def destroy(user_id) do
    script = Path.join(@scripts_dir, "soma-user-userdel")
    args = [user_id]

    case System.cmd(script, args, stderr_to_stdout: true) do
      {_output, 0} -> {:ok, user_id}
      {output, code} -> {:error, "userdel failed (exit #{code}): #{String.slice(output, 0, 200)}"}
    end
  end

  @doc """
  Username Linux para un userId.
  """
  def username(user_id), do: "user-#{String.slice(user_id, 0, 12)}"

  @doc """
  Home directory para un userId.
  """
  def home_dir(user_id), do: "/home/user-#{String.slice(user_id, 0, 12)}"

  # ── Private ──────────────────────────────────────────────────────────

  defp extract_uid_from_username(username) do
    case System.cmd("id", ["-u", username], stderr_to_stdout: true) do
      {output, 0} -> String.trim(output) |> String.to_integer()
      _ -> nil
    end
  end
end
