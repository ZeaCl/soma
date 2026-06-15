defmodule Soma.Skills do
  @moduledoc "Custom skills management + Thalamus sync."

  import Ecto.Query
  alias Soma.{Repo, CustomSkill}

  @builtin_dir "/root/.agents/skills"
  @custom_dir "/app/.pi-agent-skills"

  # ── List ─────────────────────────────────────

  def list(org_id) when is_binary(org_id) do
    custom = Repo.all(from s in CustomSkill, where: s.organization_id == ^org_id, select: s.name)
    builtin = list_builtin_skills()
    
    builtin_names = Enum.map(builtin, & &1.name)
    custom_names = MapSet.new(custom)

    # Builtin skills, mark custom ones and overrides
    builtin
    |> Enum.map(fn skill ->
      if MapSet.member?(custom_names, skill.name) do
        Map.put(skill, :custom, true)
      else
        Map.put(skill, :custom, false)
      end
    end)
    |> Enum.sort_by(& &1.name)
  end

  def list(_nil), do: []

  # ── Get ──────────────────────────────────────

  def get(org_id, name) do
    # Check custom override first
    case Repo.get_by(CustomSkill, organization_id: org_id, name: name, is_active: true) do
      %{content: content} -> {:ok, content, :custom}
      nil ->
        # Try builtin
        path = Path.join(@builtin_dir, "#{name}/SKILL.md")
        if File.exists?(path) do
          {:ok, File.read!(path), :builtin}
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
          {:ok, skill} ->
            write_custom_skill_file(name, content)
            {:ok, skill}
          error -> error
        end
      skill ->
        skill
        |> CustomSkill.changeset(%{content: content, is_active: true})
        |> Repo.update()
        |> case do
          {:ok, skill} ->
            write_custom_skill_file(name, content)
            {:ok, skill}
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

  def assign_to_agents(org_id, name, agent_ids) do
    thalamus_url = Application.get_env(:soma, :thalamus)[:url]
    
    for agent_id <- agent_ids do
      Task.start(fn ->
        Req.patch("#{thalamus_url}/api/users/#{agent_id}",
          json: %{agent_config: %{skills: [name]}},
          receive_timeout: 5000
        )
      end)
    end

    # Save assignment to local registry
    save_agent_registry(name, agent_ids)
    {:ok, %{name: name, assigned_to: agent_ids}}
  end

  # ── Agent Config ─────────────────────────────

  def list_agents(token \\ nil) do
    thalamus_url = Application.get_env(:soma, :thalamus)[:url]
    headers = if token, do: [authorization: "Bearer #{token}"], else: []
    case Req.get("#{thalamus_url}/api/users?is_agent=true", headers: headers, receive_timeout: 5000) do
      {:ok, %{status: 200, body: body}} ->
        agents = body["data"] || body["users"] || []
        {:ok, agents}
      _ ->
        {:ok, []}
    end
  end

  def update_agent_config(agent_id, attrs) do
    thalamus_url = Application.get_env(:soma, :thalamus)[:url]
    # Ensure engine field is supported
    config = Map.take(attrs, ["system_prompt", "skills", "tools", "workspace_paths", "engine"])
    case Req.patch("#{thalamus_url}/api/users/#{agent_id}",
           json: %{agent_config: config},
           receive_timeout: 5000) do
      {:ok, %{status: 200}} ->
        # Also update local config file for fallback
        update_local_config(agent_id, config)
        {:ok, config}
      {:ok, %{status: code}} -> {:error, "Thalamus returned #{code}"}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  def create_agent(org_id, attrs, token \\ nil) do
    thalamus_url = Application.get_env(:soma, :thalamus)[:url]
    body = %{
      email: attrs["email"],
      name: attrs["name"],
      password: attrs["password"] || random_password(),
      is_agent: true,
      organization_id: org_id,
      agent_config: %{
        engine: attrs["engine"] || "pi",
        system_prompt: attrs["system_prompt"],
        skills: attrs["skills"] || [],
        tools: attrs["tools"] || ["read", "bash", "edit", "write"],
        workspace_paths: attrs["workspace_paths"] || []
      }
    }
    # Use internal API (no auth required for inter-service calls)
    headers = if token, do: [authorization: "Bearer #{token}"], else: []
    case Req.post("#{thalamus_url}/api/users", json: body, headers: headers, receive_timeout: 5000) do
      {:ok, %{status: 201, body: resp}} ->
        agent = resp["data"] || resp
        update_local_config(agent["id"], agent["agent_config"] || %{})
        {:ok, agent}
      {:ok, %{status: code, body: resp}} ->
        {:error, resp["error"] || "Thalamus returned #{code}"}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  def get_agent(agent_id) do
    thalamus_url = Application.get_env(:soma, :thalamus)[:url]
    case Req.get("#{thalamus_url}/api/users/#{agent_id}", receive_timeout: 5000) do
      {:ok, %{status: 200, body: body}} ->
        {:ok, body["data"] || body}
      {:ok, %{status: 404}} ->
        {:error, :not_found}
      {:error, _} -> {:error, :not_found}
    end
  end

  def delete_agent(agent_id) do
    thalamus_url = Application.get_env(:soma, :thalamus)[:url]
    case Req.delete("#{thalamus_url}/api/users/#{agent_id}", receive_timeout: 5000) do
      {:ok, %{status: code}} when code in [200, 204] -> {:ok, agent_id}
      {:ok, %{status: 404}} -> {:error, :not_found}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  defp update_local_config(agent_id, config) do
    config_dir = "/tmp/agent-configs"
    File.mkdir_p!(config_dir)
    File.write!(
      Path.join(config_dir, "#{agent_id}.json"),
      Jason.encode!(%{
        thalamus_user_id: agent_id,
        system_prompt: config["system_prompt"],
        workspace_paths: config["workspace_paths"] || [],
        engine: config["engine"] || "pi"
      })
    )
  end

  defp random_password do
    :crypto.strong_rand_bytes(16) |> Base.url_encode64(padding: false)
  end

  # ── App Context (AGENTS.md) ──────────────────

  def load_app_context(org_id, app) do
    path = Path.join(["/workspace/orgs", org_id, app, "AGENTS.md"])
    if File.exists?(path) do
      content = File.read!(path)
      # Also resolve referenced files like site-interno/design.html
      expanded = expand_references(content, Path.dirname(path))
      {:ok, expanded}
    else
      {:ok, nil}
    end
  end

  defp expand_references(content, base_dir) do
    # Resolve relative file references like `site-interno/design.html`
    Regex.replace(~r/`([^`]+\.(?:md|html|json))`/, content, fn _, path ->
      resolved = Path.expand(path, base_dir)
      if File.exists?(resolved) do
        "`#{path}`:\n\n#{File.read!(resolved)}\n"
      else
        "`#{path}` (file not found)"
      end
    end)
  end

  # ── Private ──────────────────────────────────

  defp list_builtin_skills do
    if File.dir?(@builtin_dir) do
      case File.ls(@builtin_dir) do
        {:ok, dirs} ->
          Enum.flat_map(dirs, fn dir ->
            path = Path.join([@builtin_dir, dir, "SKILL.md"])
            if File.exists?(path) do
              content = File.read!(path)
              [description | _] = content
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
    File.mkdir_p!(dir)
    File.write!(Path.join(dir, "SKILL.md"), content)
    save_custom_registry(name)
  end

  defp remove_custom_skill_file(name) do
    dir = Path.join(@custom_dir, name)
    if File.dir?(dir), do: File.rm_rf!(dir)
  end

  defp save_custom_registry(name) do
    reg_file = Path.join(@custom_dir, ".registry.json")
    reg = case File.read(reg_file) do
      {:ok, json} -> Jason.decode!(json)
      _ -> %{}
    end
    File.write!(reg_file, Jason.encode!(Map.put(reg, name, Map.get(reg, name, []))))
  end

  defp save_agent_registry(name, agent_ids) do
    reg_file = Path.join(@custom_dir, ".registry.json")
    reg = case File.read(reg_file) do
      {:ok, json} -> Jason.decode!(json)
      _ -> %{}
    end
    File.write!(reg_file, Jason.encode!(Map.put(reg, name, agent_ids)))
  end
end
