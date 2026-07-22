defmodule SomaWeb.ConversationController do
  @moduledoc "Conversation REST endpoints."
  use Plug.Router

  alias Soma.Conversations
  import SomaWeb.Helpers, only: [json: 3]

  plug(:match)
  plug(:dispatch)

  get "/" do
    org_id = conn.assigns[:org_id]
    user_id = conn.assigns[:user_id] || "system"
    convs = Conversations.list(org_id, user_id)
    json(conn, 200, %{data: convs, total: length(convs)})
  end

  get "/:id" do
    org_id = conn.assigns[:org_id]

    case Conversations.get(org_id, id) do
      nil -> json(conn, 404, %{error: "not_found"})
      conv ->
        messages = Conversations.list_messages(id)
        json(conn, 200, %{id: conv.id, title: conv.title, messages: messages})
    end
  end

  post "/:id/messages" do
    attrs = conn.body_params

    case Conversations.add_message(id, attrs) do
      {:ok, msg} -> json(conn, 201, %{data: msg})
      {:error, cs} ->
        errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
        json(conn, 422, %{error: "validation_failed", details: errors})
    end
  end

  delete "/:id" do
    org_id = conn.assigns[:org_id]

    case Conversations.soft_delete(org_id, id) do
      {:ok, _} -> json(conn, 200, %{ok: true})
      {:error, :not_found} -> json(conn, 404, %{error: "not_found"})
    end
  end

  match _, do: Plug.Conn.send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
end
