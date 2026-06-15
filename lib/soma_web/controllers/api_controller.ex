defmodule SomaWeb.ApiController do
  use Plug.Router
  alias Soma.{Repo, ApiKey, Conversations, Workspace, Skills}

  plug :match
  plug :dispatch

  # ── Conversations ──────────────────────────────

  get "/conversations" do
    org_id = conn.assigns[:org_id]
    user_id = conn.assigns[:user_id] || "system"
    convs = Conversations.list(org_id, user_id)
    send_resp(conn, 200, Jason.encode!(%{data: convs, total: length(convs)}))
  end

  get "/conversations/:id" do
    org_id = conn.assigns[:org_id]
    case Conversations.get(org_id, id) do
      nil -> send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
      conv ->
        messages = Conversations.list_messages(id)
        send_resp(conn, 200, Jason.encode!(%{id: conv.id, title: conv.title, messages: messages}))
    end
  end

  post "/conversations/:id/messages" do
    attrs = conn.body_params
    case Conversations.add_message(id, attrs) do
      {:ok, msg} -> send_resp(conn, 201, Jason.encode!(%{data: msg}))
      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        send_resp(conn, 422, Jason.encode!(%{error: "validation_failed", details: errors}))
    end
  end

  delete "/conversations/:id" do
    org_id = conn.assigns[:org_id]
    case Conversations.soft_delete(org_id, id) do
      {:ok, _} -> send_resp(conn, 200, Jason.encode!(%{ok: true}))
      {:error, :not_found} -> send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
    end
  end

  # ── API Keys ────────────────────────────────────

  post "/api-keys" do
    org_id = conn.assigns[:org_id] || "00000000-0000-0000-0000-000000000000"
    attrs = conn.body_params

    prefix = "zs_live_"
    raw_key = prefix <> (:crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false))
    key_hash = :crypto.hash(:sha256, raw_key) |> Base.encode64()

    key_attrs = %{
      name: attrs["name"] || "default",
      key_hash: key_hash, key_prefix: prefix,
      scopes: attrs["scopes"] || ["soma:read", "soma:write"],
      organization_id: org_id,
      agent_id: attrs["agent_id"]
    }

    case %ApiKey{} |> ApiKey.changeset(key_attrs) |> Repo.insert() do
      {:ok, _} -> send_resp(conn, 201, Jason.encode!(%{api_key: raw_key, prefix: prefix}))
      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        send_resp(conn, 422, Jason.encode!(%{error: "validation_failed", details: errors}))
    end
  end

  # ── Workspace Files ─────────────────────────────

  get "/files" do
    org_id = conn.assigns[:org_id]
    agent_id = conn.params["agent_id"]
    path = conn.params["path"] || ""
    case Workspace.list_files_per_agent(org_id, agent_id, path) do
      {:ok, files} ->
        result = Enum.map(files, fn
          {name, "dir", size} -> %{name: name, type: "dir", size: size}
          {name, "file", size, ext} -> %{name: name, type: "file", size: size, ext: ext}
          other -> %{name: elem(other, 0), type: "unknown"}
        end)
        send_resp(conn, 200, Jason.encode!(%{files: result}))
      {:error, reason} ->
        send_resp(conn, 500, Jason.encode!(%{error: inspect(reason)}))
    end
  end

  get "/files/content" do
    org_id = conn.assigns[:org_id]
    path = conn.params["path"] || ""
    case Workspace.read_file(org_id, path) do
      {:ok, content} ->
        ext = Path.extname(path) |> String.downcase()
        mime = case ext do
          ".md" -> "text/markdown"
          ".json" -> "application/json"
          _ -> "text/plain"
        end
        conn |> put_resp_content_type(mime) |> send_resp(200, content)
      {:error, :not_found} ->
        send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
    end
  end

  post "/files/upload" do
    org_id = conn.assigns[:org_id]
    Workspace.ensure_org(org_id)
    attrs = conn.body_params
    name = attrs["name"] || "file"
    data = attrs["data"] || ""
    subpath = attrs["path"] || ""
    filepath = if subpath == "", do: name, else: Path.join(subpath, name)
    content = Base.decode64!(data)
    case Workspace.write_file(org_id, filepath, content) do
      {:ok, path} -> send_resp(conn, 200, Jason.encode!(%{ok: true, path: path, size: byte_size(content)}))
      {:error, reason} -> send_resp(conn, 500, Jason.encode!(%{error: inspect(reason)}))
    end
  end

  post "/files/mkdir" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params
    path = attrs["path"] || ""
    case Workspace.mkdir(org_id, path) do
      {:ok, path} -> send_resp(conn, 200, Jason.encode!(%{ok: true, path: path}))
      {:error, :already_exists} -> send_resp(conn, 409, Jason.encode!(%{error: "Ya existe"}))
      {:error, reason} -> send_resp(conn, 500, Jason.encode!(%{error: inspect(reason)}))
    end
  end

  put "/files/rename" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params
    case Workspace.rename(org_id, attrs["path"], attrs["newName"]) do
      {:ok, path} -> send_resp(conn, 200, Jason.encode!(%{ok: true, path: path}))
      {:error, :not_found} -> send_resp(conn, 404, Jason.encode!(%{error: "No encontrado"}))
      {:error, reason} -> send_resp(conn, 500, Jason.encode!(%{error: inspect(reason)}))
    end
  end

  post "/files/move" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params
    case Workspace.move(org_id, attrs["source"], attrs["dest"]) do
      {:ok, path} -> send_resp(conn, 200, Jason.encode!(%{ok: true, path: path}))
      {:error, :not_found} -> send_resp(conn, 404, Jason.encode!(%{error: "No encontrado"}))
      {:error, reason} -> send_resp(conn, 500, Jason.encode!(%{error: inspect(reason)}))
    end
  end

  delete "/files" do
    org_id = conn.assigns[:org_id]
    path = conn.params["path"] || ""
    case Workspace.delete(org_id, path) do
      {:ok, _} -> send_resp(conn, 200, Jason.encode!(%{ok: true}))
      {:error, :not_found} -> send_resp(conn, 404, Jason.encode!(%{error: "No encontrado"}))
      {:error, :directory_not_empty} -> send_resp(conn, 409, Jason.encode!(%{error: "Directorio no vacío"}))
      {:error, reason} -> send_resp(conn, 500, Jason.encode!(%{error: inspect(reason)}))
    end
  end

  get "/files/history" do
    org_id = conn.assigns[:org_id]
    path = conn.params["path"] || ""
    case Workspace.history(org_id, path) do
      {:ok, commits} -> send_resp(conn, 200, Jason.encode!(%{path: path, commits: commits}))
    end
  end

  post "/files/recover" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params
    case Workspace.recover(org_id, attrs["path"], attrs["commit"]) do
      {:ok, path} -> send_resp(conn, 200, Jason.encode!(%{ok: true, path: path}))
      {:error, reason} -> send_resp(conn, 500, Jason.encode!(%{error: inspect(reason)}))
    end
  end

  post "/files/push" do
    org_id = conn.assigns[:org_id]
    case Workspace.push(org_id) do
      {:ok, msg} -> send_resp(conn, 200, Jason.encode!(%{ok: true, output: msg}))
    end
  end

  # ── Skills ─────────────────────────────────────

  get "/skills" do
    skills = Skills.list(conn.assigns[:org_id])
    send_resp(conn, 200, Jason.encode!(%{data: skills, total: length(skills)}))
  end

  get "/skills/:name" do
    case Skills.get(conn.assigns[:org_id], name) do
      {:ok, content, source} ->
        send_resp(conn, 200, Jason.encode!(%{name: name, content: content, source: source}))
      {:error, :not_found} ->
        send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
    end
  end

  post "/skills" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params
    case Skills.upsert(org_id, attrs["name"], attrs["content"]) do
      {:ok, skill} -> send_resp(conn, 201, Jason.encode!(%{data: skill}))
      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        send_resp(conn, 422, Jason.encode!(%{error: "validation_failed", details: errors}))
    end
  end

  put "/skills/:name" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params
    case Skills.upsert(org_id, name, attrs["content"]) do
      {:ok, skill} -> send_resp(conn, 200, Jason.encode!(%{data: skill}))
      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        send_resp(conn, 422, Jason.encode!(%{error: "validation_failed", details: errors}))
    end
  end

  delete "/skills/:name" do
    org_id = conn.assigns[:org_id]
    case Skills.delete(org_id, name) do
      {:ok, _} -> send_resp(conn, 204, "")
      {:error, :not_found} -> send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
    end
  end

  put "/skills/:name/agents" do
    attrs = conn.body_params
    case Skills.assign_to_agents(conn.assigns[:org_id], name, attrs["agentIds"]) do
      {:ok, result} -> send_resp(conn, 200, Jason.encode!(result))
    end
  end

  # ── Agent Config ───────────────────────────────

  get "/agents" do
    token = get_token(conn)
    case Skills.list_agents(token) do
      {:ok, agents} -> send_resp(conn, 200, Jason.encode!(%{data: agents}))
    end
  end

  post "/agents" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params
    token = get_token(conn)
    case Skills.create_agent(org_id, attrs, token) do
      {:ok, agent} ->
        # Provision sandbox for the new agent
        agent_id = agent["id"]
        spawn(fn ->
          case Sandbox.create(agent_id, org_id,
            teams: attrs["teams"] || "",
            mounts: attrs["mounts"] || []
          ) do
            {:ok, _uid, home} ->
              # Copy assigned skills to the agent's sandbox
              config = agent["agent_config"] || %{}
              skill_names = config["skills"] || []
              for name <- skill_names do
                src = Path.join(["/root/.agents/skills", name])
                dst = Path.join([home, "skills", name])
                if File.dir?(src) do
                  File.mkdir_p!(dst)
                  File.cp_r!(src, dst)
                end
              end
            {:error, reason} ->
              require Logger
              Logger.error("Sandbox creation failed for agent #{agent_id}: #{reason}")
          end
        end)
        send_resp(conn, 201, Jason.encode!(%{data: agent}))
      {:error, reason} -> send_resp(conn, 422, Jason.encode!(%{error: reason}))
    end
  end

  get "/agents/:id" do
    case Skills.get_agent(id) do
      {:ok, agent} -> send_resp(conn, 200, Jason.encode!(%{data: agent}))
      {:error, :not_found} -> send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
    end
  end

  get "/agents/:id/skills" do
    case Skills.get_agent(id) do
      {:ok, agent} ->
        config = agent["agent_config"] || %{}
        skill_names = config["skills"] || []
        skills = Enum.map(skill_names, fn name ->
          case Skills.get(agent["organization_id"], name) do
            {:ok, content, _type} -> %{name: name, content: content}
            {:error, :not_found} -> %{name: name, error: "not_found"}
          end
        end)
        send_resp(conn, 200, Jason.encode!(%{data: skills}))
      {:error, :not_found} -> send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
    end
  end

  put "/agents/:id/config" do
    attrs = conn.body_params
    case Skills.update_agent_config(id, attrs) do
      {:ok, config} -> send_resp(conn, 200, Jason.encode!(%{ok: true, config: config}))
      {:error, reason} -> send_resp(conn, 500, Jason.encode!(%{error: reason}))
    end
  end

  delete "/agents/:id" do
    case Skills.delete_agent(id) do
      {:ok, _} -> send_resp(conn, 200, Jason.encode!(%{ok: true}))
      {:error, :not_found} -> send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
    end
  end

  # ── Agent Sharing (Google Drive model) ─────────

  post "/agents/:id/share" do
    user_id = conn.assigns[:user_id] || conn.body_params["user_id"]
    shared_with = conn.body_params["shared_with_user_id"]
    case Soma.AgentShares.share(id, shared_with, user_id) do
      {:ok, _} -> send_resp(conn, 200, Jason.encode!(%{ok: true}))
      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        send_resp(conn, 422, Jason.encode!(%{error: "validation_failed", details: errors}))
    end
  end

  delete "/agents/:id/share/:user_id" do
    case Soma.AgentShares.unshare(id, user_id) do
      {:ok, _} -> send_resp(conn, 200, Jason.encode!(%{ok: true}))
      {:error, :not_found} -> send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
    end
  end

  get "/agents/:id/shares" do
    shares = Soma.AgentShares.list_shares_for_agent(id)
    send_resp(conn, 200, Jason.encode!(%{data: shares}))
  end

  get "/agent-shares" do
    user_id = conn.assigns[:user_id] || "system"
    shares = Soma.AgentShares.list_shared_with(user_id)
    send_resp(conn, 200, Jason.encode!(%{data: shares}))
  end

  match _ do
    send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
  end

  defp get_token(conn) do
    case Plug.Conn.get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      _ -> nil
    end
  end
end
