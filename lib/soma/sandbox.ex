defmodule Soma.Sandbox do
  @moduledoc """
  OS-level sandbox management — wraps soma-agent-useradd/userdel scripts.

  Each agent gets a real Linux user with:
  - Isolated home directory (chmod 700)
  - Group membership (org + teams)
  - Bind mounts for shared volumes
  - Kernel-enforced access control
  """

  @scripts_dir Path.expand("../../scripts", __DIR__)

  @doc """
  Creates a Linux user for an agent.

  Returns `{:ok, uid, home}` on success, `{:error, reason}` on failure.
  """
  def create(agent_id, org_id, opts \\ []) do
    script = Path.join(@scripts_dir, "soma-agent-useradd")
    teams = Keyword.get(opts, :teams, "")
    mounts = Keyword.get(opts, :mounts, [])
    mounts_json = Jason.encode!(mounts)
    args = [agent_id, org_id, teams, mounts_json]

    case System.cmd(script, args, stderr_to_stdout: true) do
      {_output, 0} ->
        username = "soma-#{String.slice(agent_id, 0, 12)}"
        home = "/home/soma/#{agent_id}"
        uid = extract_uid_from_username(username)
        {:ok, uid, home}
      {output, code} ->
        {:error, "useradd failed (exit #{code}): #{String.slice(output, 0, 200)}"}
    end
  end

  @doc """
  Destroys the Linux user for an agent.

  Returns `{:ok, agent_id}` on success, `{:error, reason}` on failure.
  """
  def destroy(agent_id) do
    script = Path.join(@scripts_dir, "soma-agent-userdel")
    args = [agent_id]

    case System.cmd(script, args, stderr_to_stdout: true) do
      {_output, 0} -> {:ok, agent_id}
      {output, code} -> {:error, "userdel failed (exit #{code}): #{String.slice(output, 0, 200)}"}
    end
  end

  @doc """
  Returns the Linux username for a given agent ID.
  """
  def username(agent_id), do: "soma-#{String.slice(agent_id, 0, 12)}"

  @doc """
  Returns the home directory path for a given agent ID.
  """
  def home_dir(agent_id), do: "/home/soma/#{agent_id}"

  # ── Private ──────────────────────────────────────────────────────────

  defp extract_uid_from_username(username) do
    case System.cmd("id", ["-u", username], stderr_to_stdout: true) do
      {output, 0} -> String.trim(output) |> String.to_integer()
      _ -> nil
    end
  end
end
