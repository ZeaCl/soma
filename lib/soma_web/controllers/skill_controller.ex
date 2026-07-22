defmodule SomaWeb.SkillController do
  @moduledoc "Skill CRUD endpoints."
  use Plug.Router

  alias Soma.Skills
  import SomaWeb.Helpers, only: [json: 3]

  plug(:match)
  plug(:dispatch)

  get "/" do
    skills = Skills.list(conn.assigns[:org_id])
    json(conn, 200, %{data: skills, total: length(skills)})
  end

  get "/:name" do
    case Skills.get(conn.assigns[:org_id], name) do
      {:ok, content, source} ->
        json(conn, 200, %{name: name, content: content, source: source})

      {:error, :not_found} ->
        json(conn, 404, %{error: "not_found"})
    end
  end

  post "/" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params

    case Skills.upsert(org_id, attrs["name"], attrs["content"]) do
      {:ok, skill} -> json(conn, 201, %{data: skill})
      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        json(conn, 422, %{error: "validation_failed", details: errors})
    end
  end

  put "/:name" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params

    case Skills.upsert(org_id, name, attrs["content"]) do
      {:ok, skill} -> json(conn, 200, %{data: skill})
      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        json(conn, 422, %{error: "validation_failed", details: errors})
    end
  end

  delete "/:name" do
    org_id = conn.assigns[:org_id]

    case Skills.delete(org_id, name) do
      {:ok, _} -> Plug.Conn.send_resp(conn, 204, "")
      {:error, :not_found} -> json(conn, 404, %{error: "not_found"})
    end
  end

  put "/:name/agents" do
    attrs = conn.body_params

    case Skills.assign_to_agents(conn.assigns[:org_id], name, attrs["agentIds"]) do
      {:ok, result} -> json(conn, 200, result)
    end
  end

  match _, do: Plug.Conn.send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
end
