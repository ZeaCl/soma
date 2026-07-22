defmodule SomaWeb.ApiKeyController do
  @moduledoc "API Key creation endpoint."
  use Plug.Router
  import SomaWeb.Helpers, only: [json: 3]
  plug(:match)
  plug(:dispatch)

  post "/" do
    org_id = conn.assigns[:org_id] || "00000000-0000-0000-0000-000000000000"
    attrs = conn.body_params
    prefix = "zs_live_"
    raw_key = prefix <> Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
    key_hash = Base.encode64(:crypto.hash(:sha256, raw_key))

    key_attrs = %{
      name: attrs["name"] || "default",
      key_hash: key_hash,
      key_prefix: prefix,
      scopes: attrs["scopes"] || ["soma:read", "soma:write"],
      organization_id: org_id,
      agent_id: attrs["agent_id"]
    }

    case %Soma.ApiKey{} |> Soma.ApiKey.changeset(key_attrs) |> Soma.Repo.insert() do
      {:ok, _} ->
        json(conn, 201, %{api_key: raw_key, prefix: prefix})

      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        json(conn, 422, %{error: "validation_failed", details: errors})
    end
  end

  match(_, do: Plug.Conn.send_resp(conn, 404, Jason.encode!(%{error: "not_found"})))
end
