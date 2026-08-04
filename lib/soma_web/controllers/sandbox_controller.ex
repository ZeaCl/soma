defmodule SomaWeb.SandboxController do
  @moduledoc "Sandbox management endpoints."
  use Plug.Router

  alias Soma.{OrgWorkspace, Sandbox, UserSandbox, Workspace}
  import SomaWeb.Helpers, only: [json: 3, format_file_list: 1]

  plug(:match)
  plug(:dispatch)

  get "/" do
    list_files(conn)
  end

  get "/create" do
    do_create_sandbox(conn, conn.params)
  end

  # POST /api/sandboxes — usado por Sudlich para crear sandbox al login
  post "/" do
    do_create_sandbox(conn, conn.body_params)
  end

  delete "/:id" do
    type = conn.params["type"] || "user"

    case type do
      "user" ->
        case UserSandbox.destroy(id) do
          {:ok, _} -> json(conn, 200, %{ok: true})
          {:error, reason} -> json(conn, 500, %{error: reason})
        end

      "agent" ->
        case Sandbox.destroy(id) do
          {:ok, _} -> json(conn, 200, %{ok: true})
          {:error, reason} -> json(conn, 500, %{error: reason})
        end

      _ ->
        json(conn, 400, %{error: "type must be 'user' or 'agent'"})
    end
  end

  post "/upload" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params
    owner_type = attrs["owner_type"] || "user"
    owner_id = attrs["owner_id"]
    name = attrs["name"] || "file"
    data = attrs["data"] || ""
    subpath = attrs["path"] || ""
    filepath = if subpath == "", do: name, else: Path.join(subpath, name)
    content = Base.decode64!(data)

    base =
      case owner_type do
        "user" -> UserSandbox.home_dir(owner_id)
        "agent" -> Sandbox.home_dir(owner_id)
        "org" -> OrgWorkspace.shared_dir(org_id)
        _ -> UserSandbox.home_dir(owner_id)
      end

    full_path = Path.join([base, "workspace", filepath])
    dir = Path.dirname(full_path)
    File.mkdir_p!(dir)
    File.write!(full_path, content)

    json(conn, 200, %{
      ok: true,
      path: filepath,
      size: byte_size(content),
      owner_type: owner_type,
      owner_id: owner_id
    })
  end

  delete "/delete" do
    org_id = conn.assigns[:org_id]
    path = conn.params["path"] || ""
    owner_type = conn.params["owner_type"] || "agent"
    owner_id = conn.params["owner_id"] || ""

    if owner_type != "org" && owner_id == "" do
      json(conn, 400, %{error: "owner_id required"})
    else
      case Workspace.delete_workspace_file(owner_type, owner_id, org_id, path) do
        {:ok, _} -> json(conn, 200, %{ok: true})
        {:error, :not_found} -> json(conn, 404, %{error: "not_found"})
        {:error, :path_traversal} -> json(conn, 403, %{error: "forbidden"})
        _ -> json(conn, 500, %{error: "Unexpected error"})
      end
    end
  end

  # GET /list — alias explícito para listar archivos unificados
  get "/list" do
    list_files(conn)
  end

  match(_, do: Plug.Conn.send_resp(conn, 404, Jason.encode!(%{error: "not_found"})))

  defp list_files(conn) do
    org_id = conn.assigns[:org_id]
    owner_type = conn.params["owner_type"] || "agent"
    owner_id = conn.params["owner_id"] || ""

    # owner_id solo es obligatorio para user y agent (org usa shared dir)
    if owner_type != "org" && owner_id == "" do
      json(conn, 400, %{error: "owner_id required"})
    else
      case Workspace.list_files(owner_type, owner_id, org_id, conn.params["path"] || "") do
        {:ok, files} ->
          json(conn, 200, %{
            files: format_file_list(files),
            owner_type: owner_type,
            owner_id: owner_id
          })
      end
    end
  end

  defp do_create_sandbox(conn, attrs) do
    require Logger
    org_id = conn.assigns[:org_id]
    type = attrs["type"] || "user"
    owner_id = attrs["user_id"] || attrs["owner_id"]

    Logger.info("do_create_sandbox: org=#{inspect(org_id)} type=#{type} owner=#{owner_id}")

    if owner_id == nil || owner_id == "" do
      json(conn, 400, %{error: "user_id required"})
    else
      case type do
        "user" ->
          case UserSandbox.create(owner_id, org_id, teams: attrs["teams"]) do
            {:ok, uid, home} ->
              OrgWorkspace.ensure_shared(org_id)

              json(conn, 201, %{
                ok: true,
                username: UserSandbox.username(owner_id),
                uid: uid,
                home: home
              })

            {:error, reason} ->
              json(conn, 500, %{error: reason})
          end

        "agent" ->
          case Sandbox.create(owner_id, org_id, teams: attrs["teams"]) do
            {:ok, uid, home} ->
              OrgWorkspace.ensure_shared(org_id)

              json(conn, 201, %{
                ok: true,
                username: Sandbox.username(owner_id),
                uid: uid,
                home: home
              })

            {:error, reason} ->
              json(conn, 500, %{error: reason})
          end

        _ ->
          json(conn, 400, %{error: "type must be user or agent"})
      end
    end
  end
end
