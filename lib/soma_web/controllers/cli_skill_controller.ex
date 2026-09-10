defmodule SomaWeb.CliSkillController do
  @moduledoc "CLI Skills CRUD + installation endpoints."
  use Plug.Router

  alias Soma.CliSkills
  import SomaWeb.Helpers, only: [json: 3]

  plug(:match)
  plug(:dispatch)

  get "/" do
    org_id = conn.assigns[:org_id]
    skills = CliSkills.list(org_id)
    json(conn, 200, %{data: skills})
  end

  post "/" do
    org_id = conn.assigns[:org_id]
    attrs = Map.put(conn.body_params, "organization_id", org_id)

    case CliSkills.create(attrs) do
      {:ok, skill} -> json(conn, 201, %{data: skill})
      {:error, changeset} -> json(conn, 422, %{error: format_errors(changeset)})
    end
  end

  get "/:name" do
    org_id = conn.assigns[:org_id]

    case CliSkills.get(org_id, name) do
      {:ok, skill} -> json(conn, 200, %{data: skill})
      {:error, :not_found} -> json(conn, 404, %{error: "not_found"})
    end
  end

  put "/:name" do
    org_id = conn.assigns[:org_id]

    case CliSkills.update(org_id, name, conn.body_params) do
      {:ok, skill} -> json(conn, 200, %{data: skill})
      {:error, :not_found} -> json(conn, 404, %{error: "not_found"})
      {:error, changeset} -> json(conn, 422, %{error: format_errors(changeset)})
    end
  end

  delete "/:name" do
    org_id = conn.assigns[:org_id]

    case CliSkills.delete(org_id, name) do
      {:ok, _} -> json(conn, 200, %{ok: true})
      {:error, :not_found} -> json(conn, 404, %{error: "not_found"})
    end
  end

  post "/:name/install/:agent_id" do
    org_id = conn.assigns[:org_id]

    case CliSkills.install_to_agent(org_id, name, agent_id) do
      {:ok, result} -> json(conn, 200, %{ok: true, result: result})
      {:error, reason} -> json(conn, 422, %{error: reason})
    end
  end

  post "/:name/health-check/:agent_id" do
    org_id = conn.assigns[:org_id]

    case CliSkills.health_check(org_id, name, agent_id) do
      {:ok, output} -> json(conn, 200, %{ok: true, output: output})
      {:error, reason} -> json(conn, 422, %{error: reason})
    end
  end

  match(_, do: Plug.Conn.send_resp(conn, 404, Jason.encode!(%{error: "not_found"})))

  defp format_errors(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)
  end

  defp format_errors(error), do: error
end
