defmodule SomaWeb.AgentController do
  @moduledoc "Agent CRUD + sharing endpoints."
  use Plug.Router

  alias Soma.{AgentShares, Sandbox, Skills}
  import SomaWeb.Helpers, only: [json: 3, get_token: 1]

  plug(:match)
  plug(:dispatch)

  get "/agents" do
    token = get_token(conn)

    case Skills.list_agents(token) do
      {:ok, agents} -> json(conn, 200, %{data: agents})
    end
  end

  post "/agents" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params
    token = get_token(conn)

    case Skills.create_agent(org_id, attrs, token) do
      {:ok, agent} ->
        agent_id = agent["id"]

        spawn(fn ->
          case Sandbox.create(agent_id, org_id,
                 teams: attrs["teams"] || "",
                 mounts: attrs["mounts"] || []
               ) do
            {:ok, _uid, home} ->
              config = agent["agent_config"] || %{}
              skill_names = config["skills"] || []

              for name <- skill_names do
                src = Path.join(["/root/.agents/skills", name])
                dst = Path.join([home, "skills", name])
                if File.dir?(src), do: File.mkdir_p!(dst) && File.cp_r!(src, dst)
              end

              cfg_dir = Path.join([home, ".pi", "agent"])
              File.mkdir_p!(cfg_dir)

              File.write!(
                Path.join(cfg_dir, "config.json"),
                Jason.encode!(%{
                  "skills" => skill_names,
                  "system_prompt" => config["system_prompt"],
                  "engine" => config["engine"] || "pi",
                  "created_at" => DateTime.to_iso8601(DateTime.utc_now())
                }, pretty: true)
              )

              host_auth_dir = Path.join([System.get_env("HOME") || "/root", ".pi", "agent"])
              for file <- ["auth.json", "settings.json"] do
                src = Path.join(host_auth_dir, file)
                dst = Path.join(cfg_dir, file)
                if File.exists?(src) and not File.exists?(dst), do: File.cp!(src, dst)
              end

              username = Sandbox.username(agent_id)
              System.cmd("chown", ["-R", "#{username}:#{username}", Path.join([home, ".pi"])])

            {:error, reason} ->
              require Logger
              Logger.error("Sandbox creation failed for agent #{agent_id}: #{reason}")
          end
        end)

        json(conn, 201, %{data: agent})

      {:error, reason} ->
        json(conn, 422, %{error: reason})
    end
  end

  get "/agents/:id" do
    case Skills.get_agent(id) do
      {:ok, agent} -> json(conn, 200, %{data: agent})
      {:error, :not_found} -> json(conn, 404, %{error: "not_found"})
    end
  end

  get "/agents/:id/skills" do
    case Skills.get_agent(id) do
      {:ok, agent} ->
        config = agent["agent_config"] || %{}
        skill_names = config["skills"] || []

        skills =
          Enum.map(skill_names, fn name ->
            case Skills.get(agent["organization_id"], name) do
              {:ok, content, _type} -> %{name: name, content: content}
              {:error, :not_found} -> %{name: name, error: "not_found"}
            end
          end)

        json(conn, 200, %{data: skills})

      {:error, :not_found} ->
        json(conn, 404, %{error: "not_found"})
    end
  end

  put "/agents/:id/config" do
    attrs = conn.body_params

    case Skills.update_agent_config(id, attrs) do
      {:ok, config} -> json(conn, 200, %{ok: true, config: config})
      {:error, reason} -> json(conn, 500, %{error: reason})
    end
  end

  delete "/agents/:id" do
    case Skills.delete_agent(id) do
      {:ok, _} -> json(conn, 200, %{ok: true})
      {:error, :not_found} -> json(conn, 404, %{error: "not_found"})
    end
  end

  post "/agents/:id/share" do
    user_id = conn.assigns[:user_id] || conn.body_params["user_id"]
    shared_with = conn.body_params["shared_with_user_id"]

    case AgentShares.share(id, shared_with, user_id) do
      {:ok, _} -> json(conn, 200, %{ok: true})
      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        json(conn, 422, %{error: "validation_failed", details: errors})
    end
  end

  delete "/agents/:id/share/:user_id" do
    case AgentShares.unshare(id, user_id) do
      {:ok, _} -> json(conn, 200, %{ok: true})
      {:error, :not_found} -> json(conn, 404, %{error: "not_found"})
    end
  end

  get "/agents/:id/shares" do
    shares = AgentShares.list_shares_for_agent(id)
    json(conn, 200, %{data: shares})
  end

  get "/agent-shares" do
    user_id = conn.assigns[:user_id] || "system"
    shares = AgentShares.list_shared_with(user_id)
    json(conn, 200, %{data: shares})
  end

  match _, do: Plug.Conn.send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
end
