defmodule Soma.CliSkills do
  @moduledoc """
  CLI Skills management — CRUD + installation/uninstallation de CLIs en sandboxes.

  Un CLI Skill combina:
  1. Un binario CLI (aws, gcloud, kubectl, etc.)
  2. Un SKILL.md que enseña al agente cómo usarlo
  3. Secrets/credenciales inyectados de forma segura
  """

  import Ecto.Query
  alias Soma.CliSkill
  alias Soma.Repo
  alias Soma.Sandbox
  require Logger

  @builtin_cli_dir System.get_env("CLI_SKILLS_DIR", "/root/.agents/cli-skills")

  defp shell, do: Application.get_env(:soma, :shell, Soma.Shell.Real)
  defp fs, do: Application.get_env(:soma, :file_system, Soma.FileSystem.Real)

  # ── List ─────────────────────────────────────

  @doc "Lista CLI skills disponibles para una organización."
  def list(org_id) when is_binary(org_id) do
    db_skills =
      Repo.all(from(s in CliSkill, where: s.organization_id == ^org_id and s.is_active == true))

    builtin = list_builtin()
    db_names = MapSet.new(db_skills, & &1.name)

    # Merge: builtin que no estén ya overrideados en DB + los de DB
    unoverridden_builtin =
      Enum.reject(builtin, fn s -> MapSet.member?(db_names, s.name) end)

    (db_skills ++ unoverridden_builtin)
    |> Enum.sort_by(& &1.name)
  end

  def list(_nil), do: list_builtin()

  # ── Get ──────────────────────────────────────

  @doc "Obtiene un CLI skill por nombre para una organización."
  def get(org_id, name) do
    case Repo.get_by(CliSkill, organization_id: org_id, name: name, is_active: true) do
      %CliSkill{} = skill -> {:ok, skill}
      nil -> get_builtin(name)
    end
  end

  # ── Create ───────────────────────────────────

  @doc "Crea un nuevo CLI skill para una organización."
  def create(attrs) when is_map(attrs) do
    %CliSkill{}
    |> CliSkill.changeset(normalize_attrs(attrs))
    |> Repo.insert()
  end

  # ── Update ───────────────────────────────────

  @doc "Actualiza un CLI skill existente."
  def update(org_id, name, attrs) do
    case Repo.get_by(CliSkill, organization_id: org_id, name: name) do
      nil ->
        {:error, :not_found}

      skill ->
        skill
        |> CliSkill.changeset(normalize_attrs(attrs))
        |> Repo.update()
    end
  end

  # ── Delete ───────────────────────────────────

  @doc "Soft-delete de un CLI skill."
  def delete(org_id, name) do
    case Repo.get_by(CliSkill, organization_id: org_id, name: name) do
      nil -> {:error, :not_found}
      skill -> Repo.update(CliSkill.changeset(skill, %{is_active: false}))
    end
  end

  # ── Install to Agent ─────────────────────────

  @doc """
  Instala un CLI skill en el sandbox de un agente.

  1. Instala el binario según install_method
  2. Copia el SKILL.md al directorio de skills del agente
  3. Genera archivos de configuración con secrets
  4. Ejecuta post_install_cmd si existe
  """
  def install_to_agent(org_id, cli_skill_name, agent_id) do
    with {:ok, skill} <- get(org_id, cli_skill_name) do
      home = Sandbox.home_dir(agent_id)
      username = Sandbox.username(agent_id)

      steps = [
        {:install_binary, fn -> install_binary(skill, home, username) end},
        {:install_skill, fn -> install_skill_file(skill, home, username) end},
        {:generate_config, fn -> generate_config_files(skill, home, org_id, username) end},
        {:post_install, fn -> run_post_install(skill, home, username) end},
        {:update_agent_config, fn -> add_cli_skill_to_config(agent_id, home, skill.name) end}
      ]

      results =
        Enum.reduce_while(steps, [], fn {step, func}, acc ->
          case func.() do
            :ok -> {:cont, [{step, :ok} | acc]}
            {:ok, _} = result -> {:cont, [{step, result} | acc]}
            {:error, reason} -> {:halt, [{step, {:error, reason}} | acc]}
          end
        end)

      if Enum.all?(results, fn {_, r} -> r == :ok or match?({:ok, _}, r) end) do
        {:ok, %{installed: cli_skill_name, agent_id: agent_id, steps: length(results)}}
      else
        failed = Enum.find(results, fn {_, r} -> match?({:error, _}, r) end)
        {:error, "Installation failed at #{elem(failed, 0)}: #{inspect(elem(failed, 1))}"}
      end
    end
  end

  @doc "Desinstala un CLI skill del sandbox de un agente."
  def uninstall_from_agent(org_id, cli_skill_name, agent_id) do
    with {:ok, skill} <- get(org_id, cli_skill_name) do
      home = Sandbox.home_dir(agent_id)

      # Remove binary
      bin_path = Path.join([home, ".local", "bin", skill.cli_binary])
      if File.exists?(bin_path), do: File.rm(bin_path)

      # Remove skill file
      skill_dir = Path.join([home, ".pi", "agent", "skills", skill.name])
      if File.dir?(skill_dir), do: File.rm_rf(skill_dir)

      # Remove from config.json
      remove_cli_skill_from_config(agent_id, home, skill.name)

      {:ok, %{uninstalled: cli_skill_name, agent_id: agent_id}}
    end
  end

  # ── Health Check ─────────────────────────────

  @doc "Ejecuta el health check de un CLI skill en el sandbox de un agente."
  def health_check(org_id, cli_skill_name, agent_id) do
    with {:ok, skill} <- get(org_id, cli_skill_name) do
      if skill.health_check_cmd do
        home = Sandbox.home_dir(agent_id)
        username = Sandbox.username(agent_id)

        cmd =
          "cd #{home} && PATH=#{home}/.local/bin:$PATH #{skill.health_check_cmd}"

        case shell().cmd("sudo", ["-u", username, "bash", "-c", cmd], stderr_to_stdout: true) do
          {output, 0} ->
            {:ok, String.trim(output)}

          {output, code} ->
            {:error, "Health check failed (exit #{code}): #{String.slice(output, 0, 500)}"}
        end
      else
        {:ok, "No health check configured for #{cli_skill_name}"}
      end
    end
  end

  # ── CLI Skills para un agente ────────────────

  @doc "Lista los CLI skills instalados en un agente."
  def list_for_agent(agent_id) do
    home = Sandbox.home_dir(agent_id)
    config_path = Path.join([home, ".pi", "agent", "config.json"])

    case fs().read(config_path) do
      {:ok, content} ->
        case Jason.decode(content) do
          {:ok, config} -> config["cli_skills"] || []
          _ -> []
        end

      _ ->
        []
    end
  end

  @doc "Obtiene env vars necesarias para los CLI skills de un agente."
  def resolve_env_vars(org_id, user_id, agent_id) do
    secret_provider = Application.get_env(:soma, :secret_provider, Soma.SecretProvider.Thalamus)

    cli_skill_names = list_for_agent(agent_id)

    Enum.flat_map(cli_skill_names, fn name ->
      case get(org_id, name) do
        {:ok, skill} ->
          Enum.flat_map(skill.required_secrets, fn secret_name ->
            env_var = Map.get(skill.env_mapping || %{}, secret_name, secret_name)

            case secret_provider.resolve_secret(org_id, user_id, String.downcase(secret_name)) do
              {:ok, value} -> [{env_var, value}]
              _ -> []
            end
          end)

        _ ->
          []
      end
    end)
  end

  # ── Private: Installation ────────────────────

  defp install_binary(skill, home, username) do
    bin_dir = Path.join([home, ".local", "bin"])
    File.mkdir_p!(bin_dir)

    result =
      case skill.install_method do
        "apt" -> install_via_apt(skill.install_spec, home, username)
        "script" -> install_via_script(skill.install_spec, home, username)
        "binary" -> install_via_binary(skill.install_spec, home, bin_dir)
        "npm" -> install_via_npm(skill.install_spec, home, username)
        "pip" -> install_via_pip(skill.install_spec, home, username)
        other -> {:error, "Unknown install method: #{other}"}
      end

    case result do
      {_output, 0} -> :ok
      :ok -> :ok
      {:ok, _} -> :ok
      {:error, _} = err -> err
      {output, code} -> {:error, "Install failed (exit #{code}): #{String.slice(output, 0, 300)}"}
    end
  end

  defp install_via_apt(%{"packages" => packages}, _home, username) when is_list(packages) do
    # Agent installs to user-local via apt download + dpkg extract
    cmds = Enum.map_join(packages, " && ", &"apt-get download #{&1}")
    shell().cmd("sudo", ["-u", username, "bash", "-c", cmds], stderr_to_stdout: true)
  end

  defp install_via_apt(_, _, _), do: {:error, "apt install_spec requires 'packages' list"}

  defp install_via_script(%{"commands" => commands}, home, username) when is_list(commands) do
    script = Enum.join(commands, " && ")
    cmd = "cd #{home} && PATH=#{home}/.local/bin:$PATH #{script}"
    shell().cmd("sudo", ["-u", username, "bash", "-c", cmd], stderr_to_stdout: true)
  end

  defp install_via_script(_, _, _), do: {:error, "script install_spec requires 'commands' list"}

  defp install_via_binary(%{"url" => url, "binary_path" => bin_name}, home, bin_dir) do
    tmp = Path.join([home, ".local", "tmp"])
    File.mkdir_p!(tmp)
    dest = Path.join(bin_dir, bin_name)

    cmds = "curl -sL '#{url}' -o #{dest} && chmod +x #{dest}"

    shell().cmd("bash", ["-c", cmds], stderr_to_stdout: true)
  end

  defp install_via_binary(_, _, _),
    do: {:error, "binary install_spec requires 'url' and 'binary_path'"}

  defp install_via_npm(%{"package" => package}, home, username) do
    cmd = "cd #{home} && npm install -g #{package} --prefix #{home}/.local"
    shell().cmd("sudo", ["-u", username, "bash", "-c", cmd], stderr_to_stdout: true)
  end

  defp install_via_npm(_, _, _), do: {:error, "npm install_spec requires 'package'"}

  defp install_via_pip(%{"package" => package}, home, username) do
    cmd = "cd #{home} && pip install --user #{package}"
    shell().cmd("sudo", ["-u", username, "bash", "-c", cmd], stderr_to_stdout: true)
  end

  defp install_via_pip(_, _, _), do: {:error, "pip install_spec requires 'package'"}

  # ── Private: Skill file ─────────────────────

  defp install_skill_file(skill, home, username) do
    skill_dir = Path.join([home, ".pi", "agent", "skills", skill.name])
    File.mkdir_p!(skill_dir)
    File.write!(Path.join(skill_dir, "SKILL.md"), skill.skill_content)

    # Fix ownership
    shell().cmd("chown", ["-R", "#{username}:#{username}", skill_dir], stderr_to_stdout: true)
    :ok
  end

  # ── Private: Config files ───────────────────

  defp generate_config_files(skill, home, org_id, username) do
    secret_provider = Application.get_env(:soma, :secret_provider, Soma.SecretProvider.Thalamus)
    config_files = skill.config_files || %{}

    case config_files do
      files when is_list(files) ->
        Enum.each(files, fn file_spec ->
          path = String.replace(file_spec["path"] || "", "~", home)
          template = file_spec["template"] || ""

          # Resolve template variables from secrets
          content =
            Regex.replace(~r/\{\{(\w+)(?:\|([^}]*))?\}\}/, template, fn _, var, default ->
              case secret_provider.resolve_secret(org_id, nil, String.downcase(var)) do
                {:ok, value} -> value
                _ -> if default != "", do: default, else: "UNSET_#{var}"
              end
            end)

          File.mkdir_p!(Path.dirname(path))
          File.write!(path, content)
          File.chmod!(path, 0o600)
          shell().cmd("chown", ["#{username}:#{username}", path], stderr_to_stdout: true)
        end)

        :ok

      _ ->
        :ok
    end
  end

  # ── Private: Post-install ───────────────────

  defp run_post_install(skill, home, username) do
    if skill.post_install_cmd && skill.post_install_cmd != "" do
      cmd = "cd #{home} && PATH=#{home}/.local/bin:$PATH #{skill.post_install_cmd}"

      case shell().cmd("sudo", ["-u", username, "bash", "-c", cmd], stderr_to_stdout: true) do
        {_output, 0} ->
          :ok

        {output, code} ->
          {:error, "Post-install failed (exit #{code}): #{String.slice(output, 0, 300)}"}
      end
    else
      :ok
    end
  end

  # ── Private: Agent config ───────────────────

  defp add_cli_skill_to_config(agent_id, home, cli_skill_name) do
    config_path = Path.join([home, ".pi", "agent", "config.json"])

    config =
      case fs().read(config_path) do
        {:ok, content} ->
          case Jason.decode(content) do
            {:ok, c} -> c
            _ -> %{}
          end

        _ ->
          %{}
      end

    current = config["cli_skills"] || []

    unless cli_skill_name in current do
      config = Map.put(config, "cli_skills", current ++ [cli_skill_name])
      File.mkdir_p!(Path.dirname(config_path))
      File.write!(config_path, Jason.encode!(config, pretty: true))

      username = Sandbox.username(agent_id)
      shell().cmd("chown", ["#{username}:#{username}", config_path], stderr_to_stdout: true)
    end

    :ok
  end

  defp remove_cli_skill_from_config(_agent_id, home, cli_skill_name) do
    config_path = Path.join([home, ".pi", "agent", "config.json"])

    case fs().read(config_path) do
      {:ok, content} ->
        case Jason.decode(content) do
          {:ok, config} ->
            current = config["cli_skills"] || []
            updated = Enum.reject(current, &(&1 == cli_skill_name))
            config = Map.put(config, "cli_skills", updated)
            File.write!(config_path, Jason.encode!(config, pretty: true))

          _ ->
            :ok
        end

      _ ->
        :ok
    end
  end

  # ── Private: Builtin CLI skills ─────────────

  defp list_builtin do
    if fs().dir?(@builtin_cli_dir) do
      case fs().ls(@builtin_cli_dir) do
        {:ok, dirs} ->
          Enum.flat_map(dirs, fn dir ->
            manifest = Path.join([@builtin_cli_dir, dir, "manifest.json"])

            if fs().exists?(manifest) do
              case fs().read(manifest) do
                {:ok, json} ->
                  case Jason.decode(json) do
                    {:ok, data} -> [builtin_to_struct(data, dir)]
                    _ -> []
                  end

                _ ->
                  []
              end
            else
              []
            end
          end)

        _ ->
          []
      end
    else
      []
    end
  end

  defp get_builtin(name) do
    case Enum.find(list_builtin(), &(&1.name == name)) do
      nil -> {:error, :not_found}
      skill -> {:ok, skill}
    end
  end

  defp builtin_to_struct(data, dir_name) do
    skill_path = Path.join([@builtin_cli_dir, dir_name, "SKILL.md"])

    skill_content =
      if fs().exists?(skill_path) do
        fs().read!(skill_path)
      else
        data["skill_content"] || ""
      end

    %CliSkill{
      name: data["name"] || dir_name,
      cli_binary: data["cli_binary"] || dir_name,
      version: data["version"],
      install_method: data["install_method"] || "binary",
      install_spec: data["install_spec"] || %{},
      skill_content: skill_content,
      required_secrets: data["required_secrets"] || [],
      env_mapping: data["env_mapping"] || %{},
      config_files: data["config_files"] || %{},
      post_install_cmd: data["post_install_cmd"],
      health_check_cmd: data["health_check_cmd"],
      is_active: true,
      is_builtin: true
    }
  end

  # ── Private: Helpers ────────────────────────

  defp normalize_attrs(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_binary(k) -> {String.to_existing_atom(k), v}
      {k, v} when is_atom(k) -> {k, v}
    end)
  rescue
    ArgumentError -> attrs
  end
end
