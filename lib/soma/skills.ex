defmodule Soma.Skills do
  @moduledoc "Custom skills management + Thalamus sync."

  import Ecto.Query
  alias Soma.CustomSkill
  alias Soma.Repo

  @builtin_dir System.get_env("SKILLS_DIR", "/root/.agents/skills")
  @custom_dir "/app/.pi-agent-skills"

  # ── Dependency injection ────────────────────

  defp thalamus_client do
    Application.get_env(:soma, :thalamus_client, Soma.ThalamusClient.Real)
  end

  defp file_system do
    Application.get_env(:soma, :file_system, Soma.FileSystem.Real)
  end

  # ── List ─────────────────────────────────────

  def list(org_id) when is_binary(org_id) do
    custom =
      Repo.all(
        from(s in CustomSkill, where: s.organization_id == ^org_id, select: {s.name, s.content})
      )

    custom_names = MapSet.new(custom, fn {name, _} -> name end)
    builtin = list_builtin_skills()
    builtin_names = Enum.map(builtin, & &1.name)

    skills =
      Enum.map(builtin, fn skill ->
        Map.put(skill, :custom, MapSet.member?(custom_names, skill.name))
      end)

    pure_custom =
      Enum.flat_map(custom, fn {name, content} ->
        if name in builtin_names do
          []
        else
          desc =
            content
            |> String.split("\n")
            |> Enum.find(&(&1 != "" && !String.starts_with?(&1, ["---", "name:", "#"])))

          [%{name: name, description: String.slice(desc || "", 0, 120), builtin: false, custom: true}]
        end
      end)

    (skills ++ pure_custom)
    |> add_agent_assignments()
    |> Enum.sort_by(& &1.name)
  end

  def list(_nil), do: list_builtin_skills() |> Enum.map(&Map.put(&1, :custom, false))

  defp add_agent_assignments(skills) do
    registry = read_agent_registry()
    Enum.map(skills, fn skill -> Map.put(skill, :agents, Map.get(registry, skill.name, [])) end)
  end

  defp read_agent_registry do
    reg_file = Path.join(@custom_dir, ".registry.json")
    case file_system().read(reg_file) do
      {:ok, json} -> Jason.decode!(json)
      _ -> %{}
    end
  end

  # ── Get ──────────────────────────────────────

  def get(org_id, name) do
    case Repo.get_by(CustomSkill, organization_id: org_id, name: name, is_active: true) do
      %{content: content} ->
        {:ok, content, :custom}

      nil ->
        path = Path.join(@builtin_dir, "#{name}/SKILL.md")
        if file_system().exists?(path) do
          {:ok, file_system().read!(path), :builtin}
        else
          {:error, :not_found}
        end
    end
  end

  # ── Create / Update ──────────────────────────

  def upsert(org_id, name, content) do
    case Repo.get_by(CustomSkill, organization_id: org_id, name: name) do
      nil ->
        %CustomSkill{}
        |> CustomSkill.changeset(%{organization_id: org_id, name: name, content: content, is_active: true})
        |> Repo.insert()
        |> case do
          {:ok, skill} -> write_custom_skill_file(name, content); {:ok, skill}
          error -> error
        end

      skill ->
        skill
        |> CustomSkill.changeset(%{content: content, is_active: true})
        |> Repo.update()
        |> case do
          {:ok, skill} -> write_custom_skill_file(name, content); {:ok, skill}
          error -> error
        end
    end
  end

  # ── Delete ───────────────────────────────────

  def delete(org_id, name) do
    case Repo.get_by(CustomSkill, organization_id: org_id, name: name) do
      nil -> {:error, :not_found}
      skill ->
        Repo.update(CustomSkill.changeset(skill, %{is_active: false}))
        remove_custom_skill_file(name)
        {:ok, name}
    end
  end

  # ── Agent Assignment ─────────────────────────

  def assign_to_agents(_org_id, name, agent_ids) do
    for agent_id <- agent_ids do
      Task.start(fn ->
        thalamus_client().update_user(agent_id, %{skills: [name]}, nil)
      end)
    end

    save_agent_registry(name, agent_ids)
    {:ok, %{name: name, assigned_to: agent_ids}}
  end

  # ── Agent Config ─────────────────────────────

  def list_agents(token \\ nil) do
    thalamus_client().get_user(token)
  end

  def update_agent_config(agent_id, attrs) do
    config = Map.take(attrs, ["system_prompt", "skills", "tools", "workspace_paths", "engine"])
    case thalamus_client().update_user(agent_id, config, nil) do
      {:ok, _} ->
        update_local_config(agent_id, config)
        {:ok, config}
      error -> error
    end
  end

  def create_agent(org_id, attrs, token \\ nil) do
    body = %{
      email: attrs["email"], name: attrs["name"],
      password: attrs["password"] || random_password(),
      is_agent: true, organization_id: org_id,
      agent_config: %{
        engine: attrs["engine"] || "pi",
        system_prompt: attrs["system_prompt"],
        skills: attrs["skills"] || [],
        tools: attrs["tools"] || ["read", "bash", "edit", "write"],
        workspace_paths: attrs["workspace_paths"] || []
      }
    }

    case thalamus_client().create_user(body, token) do
      {:ok, agent} ->
        update_local_config(agent["id"], agent["agent_config"] || %{})
        {:ok, agent}
      error -> error
    end
  end

  def get_agent(agent_id) do
    thalamus_client().get_user_by_id(agent_id)
  end

  def delete_agent(agent_id) do
    thalamus_client().delete_user(agent_id)
  end

  # ── App Context ──────────────────────────────

  def load_app_context(org_id, app) do
    path = Path.join(["/workspace/orgs", org_id, app, "AGENTS.md"])
    if file_system().exists?(path) do
      content = file_system().read!(path)
      expanded = expand_references(content, Path.dirname(path))
      {:ok, expanded}
    else
      {:ok, nil}
    end
  end

  defp expand_references(content, base_dir) do
    Regex.replace(~r/`([^`]+\.(?:md|html|json))`/, content, fn _, fpath ->
      resolved = Path.expand(fpath, base_dir)
      if file_system().exists?(resolved) do
        "`#{fpath}`:\n\n#{file_system().read!(resolved)}\n"
      else
        "`#{fpath}` (file not found)"
      end
    end)
  end

  # ── Private ──────────────────────────────────

  defp random_password do
    Base.url_encode64(:crypto.strong_rand_bytes(16), padding: false)
  end

  defp update_local_config(agent_id, config) do
    config_dir = "/tmp/agent-configs"
    file_system().mkdir_p(config_dir)
    file_system().write(
      Path.join(config_dir, "#{agent_id}.json"),
      Jason.encode!(%{
        thalamus_user_id: agent_id,
        system_prompt: config["system_prompt"],
        workspace_paths: config["workspace_paths"] || [],
        engine: config["engine"] || "pi"
      })
    )
  end

  defp list_builtin_skills do
    if file_system().dir?(@builtin_dir) do
      case file_system().ls(@builtin_dir) do
        {:ok, dirs} ->
          Enum.flat_map(dirs, fn dir ->
            path = Path.join([@builtin_dir, dir, "SKILL.md"])
            if file_system().exists?(path) do
              content = file_system().read!(path)
              [description | _] =
                content
                |> String.split("\n")
                |> Enum.filter(&(&1 != "" && !String.starts_with?(&1, ["---", "name:", "#"])))
              [%{name: dir, description: String.slice(description || "", 0, 120), builtin: true}]
            else
              []
            end
          end)
        _ -> []
      end
    else
      []
    end
  end

  defp write_custom_skill_file(name, content) do
    dir = Path.join(@custom_dir, name)
    file_system().mkdir_p(dir)
    file_system().write(Path.join(dir, "SKILL.md"), content)
    save_custom_registry(name)
  end

  defp remove_custom_skill_file(name) do
    dir = Path.join(@custom_dir, name)
    if file_system().dir?(dir), do: file_system().rm_rf(dir)
  end

  defp save_custom_registry(name) do
    reg_file = Path.join(@custom_dir, ".registry.json")
    reg = case file_system().read(reg_file) do
      {:ok, json} -> Jason.decode!(json)
      _ -> %{}
    end
    file_system().write(reg_file, Jason.encode!(Map.put(reg, name, Map.get(reg, name, []))))
  end

  defp save_agent_registry(name, agent_ids) do
    reg_file = Path.join(@custom_dir, ".registry.json")
    reg = case file_system().read(reg_file) do
      {:ok, json} -> Jason.decode!(json)
      _ -> %{}
    end
    file_system().write(reg_file, Jason.encode!(Map.put(reg, name, agent_ids)))
  end
end
