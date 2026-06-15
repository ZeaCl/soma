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
    # Call agent server internal API to create Linux user
    agent_host = Application.get_env(:soma, :agent_host) || "http://zea-agent:3001"
    case Req.post("#{agent_host}/internal/users", json: %{agentId: agent_id}, receive_timeout: 5000) do
      {:ok, %{status: 201, body: body}} ->
        username = body["username"] || "soma-#{String.slice(agent_id, 0, 12)}"
        home = body["home"] || "/home/soma/#{agent_id}"
        uid = extract_uid_from_username(username)
        {:ok, uid, home}
      {:ok, %{status: code, body: body}} ->
        {:error, "agent server returned #{code}: #{inspect(body)}"}
      {:error, reason} ->
        {:error, "agent server unreachable: #{inspect(reason)}"}
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
