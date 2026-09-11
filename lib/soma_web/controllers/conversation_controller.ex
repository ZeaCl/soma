defmodule SomaWeb.ConversationController do
  @moduledoc "Conversation REST endpoints."
  use Plug.Router

  alias Soma.Conversations
  alias SomaWeb.ConversationView
  alias SomaWeb.MessageView
  import SomaWeb.Helpers, only: [json: 3]

  plug(:match)
  plug(:dispatch)

  get "/" do
    org_id = conn.assigns[:org_id]
    user_id = conn.assigns[:user_id] || "system"
    convs = Conversations.list(org_id, user_id)
    json(conn, 200, ConversationView.render("index.json", %{conversations: convs}))
  end

  defp get_query(conn, key) do
    case conn.query_params do
      %Plug.Conn.Unfetched{} -> nil
      params -> params[key]
    end
  rescue
    _ -> nil
  end

  get "/:id" do
    org_id = conn.assigns[:org_id]

    case Conversations.get(org_id, id) do
      nil ->
        json(conn, 404, %{error: "not_found"})

      conv ->
        limit = parse_int(get_query(conn, "limit"), 50) |> min(200) |> max(1)
        before = get_query(conn, "before")

        page = Conversations.list_messages_page(conv.id, limit: limit, before: before)

        json(
          conn,
          200,
          ConversationView.render("show.json", %{
            conversation: conv,
            messages: page.messages,
            pagination: %{
              hasMore: page.has_more,
              nextCursor: page.next_cursor,
              limit: limit
            }
          })
        )
    end
  end

  defp parse_int(nil, default), do: default

  defp parse_int(value, default) do
    case Integer.parse(to_string(value)) do
      {n, _} -> n
      :error -> default
    end
  end

  post "/:id/messages" do
    org_id = conn.assigns[:org_id]
    attrs = conn.body_params

    conv_id =
      case Conversations.get(org_id, id) do
        %Soma.Conversation{id: conv_uuid} -> conv_uuid
        nil -> id
      end

    case Conversations.add_message(conv_id, attrs) do
      {:ok, msg} ->
        json(conn, 201, %{data: MessageView.message_json(msg)})

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

  match(_, do: Plug.Conn.send_resp(conn, 404, Jason.encode!(%{error: "not_found"})))
end
