defmodule Soma.UserSandbox do
  @moduledoc """
  OS-level sandbox management para usuarios humanos.
  """

  @scripts_dir Application.compile_env(:soma, :scripts_dir, "/usr/local/bin")

  defp shell, do: Application.get_env(:soma, :shell, Soma.Shell.Real)

  @doc "Crea un usuario Linux para un humano."
  def create(user_id, org_id, opts \\ []) do
    script = Path.join(@scripts_dir, "soma-user-useradd")
    teams = Keyword.get(opts, :teams, "") || ""
    args = [user_id, org_id, teams]

    case shell().cmd(script, args, stderr_to_stdout: true) do
      {_output, 0} ->
        username = username(user_id)
        home = "/home/#{username}"
        uid = extract_uid(username)
        {:ok, uid, home}

      {output, code} ->
        {:error, "useradd failed (exit #{code}): #{String.slice(output, 0, 200)}"}
    end
  end

  @doc "Destruye el usuario Linux."
  def destroy(user_id) do
    script = Path.join(@scripts_dir, "soma-user-userdel")
    args = [user_id]

    case shell().cmd(script, args, stderr_to_stdout: true) do
      {_output, 0} -> {:ok, user_id}
      {output, code} -> {:error, "userdel failed (exit #{code}): #{String.slice(output, 0, 200)}"}
    end
  end

  def username(user_id), do: "user-#{String.slice(user_id, 0, 12)}"
  def home_dir(user_id), do: "/home/user-#{String.slice(user_id, 0, 12)}"

  defp extract_uid(username) do
    case shell().cmd("id", ["-u", username], stderr_to_stdout: true) do
      {output, 0} -> String.to_integer(String.trim(output))
      _ -> nil
    end
  end
end
