defmodule Soma.Sandbox do
  @moduledoc """
  OS-level sandbox management — wraps soma-agent-useradd/userdel scripts.

  Cada agente tiene un usuario Linux real con home aislado (chmod 700).
  """

  @scripts_dir Application.compile_env(:soma, :scripts_dir, "/usr/local/bin")

  @doc "Shell adapter (inyectable para tests)"
  def shell, do: Application.get_env(:soma, :shell, Soma.Shell.Real)

  @doc """
  Crea un usuario Linux para un agente.
  Retorna {:ok, uid, home} o {:error, reason}.
  """
  def create(agent_id, org_id, opts \\ []) do
    script = Path.join(@scripts_dir, "soma-agent-useradd")
    teams = Keyword.get(opts, :teams, "") || ""
    mounts = Keyword.get(opts, :mounts, [])
    mounts_json = Jason.encode!(mounts)
    args = [agent_id, org_id, teams, mounts_json]

    case shell().cmd(script, args, stderr_to_stdout: true) do
      {_output, 0} ->
        username = username(agent_id)
        home = "/home/#{username}"
        uid = extract_uid(username)
        {:ok, uid, home}

      {output, code} ->
        {:error, "useradd failed (exit #{code}): #{String.slice(output, 0, 200)}"}
    end
  end

  @doc "Destruye el usuario Linux de un agente."
  def destroy(agent_id) do
    script = Path.join(@scripts_dir, "soma-agent-userdel")
    args = [agent_id]

    case shell().cmd(script, args, stderr_to_stdout: true) do
      {_output, 0} -> {:ok, agent_id}
      {output, code} -> {:error, "userdel failed (exit #{code}): #{String.slice(output, 0, 200)}"}
    end
  end

  @doc "Nombre de usuario Linux para un agent_id."
  def username(agent_id), do: "soma-#{String.slice(agent_id, 0, 12)}"

  @doc "Home directory para un agent_id."
  def home_dir(agent_id), do: "/home/soma-#{String.slice(agent_id, 0, 12)}"

  # ── Private ──────────────────────────────────────────────────────────

  defp extract_uid(username) do
    case shell().cmd("id", ["-u", username], stderr_to_stdout: true) do
      {output, 0} -> String.trim(output) |> String.to_integer()
      _ -> nil
    end
  end
end
