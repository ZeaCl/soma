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
    teams = Keyword.get(opts, :teams, "")
    mounts = Keyword.get(opts, :mounts, [])

    script = Path.join(@scripts_dir, "soma-agent-useradd")
    args = [agent_id, org_id, teams, Jason.encode!(mounts)]

    case System.cmd(script, args, stderr_to_stdout: true) do
      {output, 0} ->
        uid = extract_uid(output)
        home = "/home/soma/#{agent_id}"
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

  defp extract_uid(output) do
    # Look for "uid=XXXX" in the output
    case Regex.run(~r/uid=(\d+)/, output) do
      [_, uid_str] -> String.to_integer(uid_str)
      nil -> nil
    end
  end
end
