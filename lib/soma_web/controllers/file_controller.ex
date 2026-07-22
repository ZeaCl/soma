defmodule SomaWeb.FileController do
  @moduledoc "File workspace endpoints."
  use Plug.Router
  alias Soma.Workspace
  import SomaWeb.Helpers, only: [json: 3, format_file_list: 1]
  plug(:match)
  plug(:dispatch)

  get "/" do
    org_id = conn.assigns[:org_id]
    path = conn.params["path"] || ""
    agent_id = conn.params["agent_id"]

    case Workspace.list_files_per_agent(org_id, agent_id, path) do
      {:ok, files} -> json(conn, 200, %{files: format_file_list(files)})
      {:error, reason} -> json(conn, 500, %{error: inspect(reason)})
    end
  end

  get "/content" do
    org_id = conn.assigns[:org_id]
    path = conn.params["path"] || ""

    case Workspace.read_file(org_id, path) do
      {:ok, content} ->
        mime =
          case String.downcase(Path.extname(path)) do
            ".md" -> "text/markdown"
            ".json" -> "application/json"
            _ -> "text/plain"
          end

        conn |> Plug.Conn.put_resp_content_type(mime) |> Plug.Conn.send_resp(200, content)

      {:error, :not_found} ->
        json(conn, 404, %{error: "not_found"})
    end
  end

  post "/upload" do
    org_id = conn.assigns[:org_id]
    Workspace.ensure_org(org_id)
    attrs = conn.body_params
    name = attrs["name"] || "file"
    subpath = attrs["path"] || ""
    filepath = if subpath == "", do: name, else: Path.join(subpath, name)
    content = Base.decode64!(attrs["data"] || "")

    case Workspace.write_file(org_id, filepath, content) do
      {:ok, path} -> json(conn, 200, %{ok: true, path: path, size: byte_size(content)})
      {:error, reason} -> json(conn, 500, %{error: inspect(reason)})
    end
  end

  post "/mkdir" do
    attrs = conn.body_params

    case Workspace.mkdir(conn.assigns[:org_id], attrs["path"] || "") do
      {:ok, path} -> json(conn, 200, %{ok: true, path: path})
      {:error, :already_exists} -> json(conn, 409, %{error: "Ya existe"})
      {:error, reason} -> json(conn, 500, %{error: inspect(reason)})
    end
  end

  put "/rename" do
    attrs = conn.body_params

    case Workspace.rename(conn.assigns[:org_id], attrs["path"], attrs["newName"]) do
      {:ok, path} -> json(conn, 200, %{ok: true, path: path})
      {:error, :not_found} -> json(conn, 404, %{error: "No encontrado"})
      {:error, reason} -> json(conn, 500, %{error: inspect(reason)})
    end
  end

  post "/move" do
    attrs = conn.body_params

    case Workspace.move(conn.assigns[:org_id], attrs["source"], attrs["dest"]) do
      {:ok, path} -> json(conn, 200, %{ok: true, path: path})
      {:error, :not_found} -> json(conn, 404, %{error: "No encontrado"})
      {:error, reason} -> json(conn, 500, %{error: inspect(reason)})
    end
  end

  delete "/" do
    path = conn.params["path"] || ""

    case Workspace.delete(conn.assigns[:org_id], path) do
      {:ok, _} -> json(conn, 200, %{ok: true})
      {:error, :not_found} -> json(conn, 404, %{error: "No encontrado"})
      {:error, :directory_not_empty} -> json(conn, 409, %{error: "Directorio no vacío"})
      {:error, reason} -> json(conn, 500, %{error: inspect(reason)})
    end
  end

  get "/history" do
    path = conn.params["path"] || ""

    case Workspace.history(conn.assigns[:org_id], path) do
      {:ok, commits} -> json(conn, 200, %{path: path, commits: commits})
    end
  end

  post "/recover" do
    attrs = conn.body_params

    case Workspace.recover(conn.assigns[:org_id], attrs["path"], attrs["commit"]) do
      {:ok, path} -> json(conn, 200, %{ok: true, path: path})
      {:error, reason} -> json(conn, 500, %{error: inspect(reason)})
    end
  end

  post "/push" do
    case Workspace.push(conn.assigns[:org_id]) do
      {:ok, msg} -> json(conn, 200, %{ok: true, output: msg})
    end
  end

  match(_, do: Plug.Conn.send_resp(conn, 404, Jason.encode!(%{error: "not_found"})))
end
