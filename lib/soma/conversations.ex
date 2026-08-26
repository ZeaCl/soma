defmodule Soma.Conversations do
  @moduledoc "Conversation management — list, get, create, soft-delete."
  import Ecto.Query
  alias Soma.Conversation
  alias Soma.Message
  alias Soma.Repo

  def list(org_id, user_id) do
    org_id = normalize_org_id(org_id)
    user_id = normalize_user_id(user_id)

    Repo.all(
      from(c in Conversation,
        where: c.organization_id == ^org_id and c.user_id == ^user_id and c.is_deleted == false,
        order_by: [desc: c.last_message_at]
      )
    )
  end

  def get(org_id, id) do
    org_id = normalize_org_id(org_id)

    case Ecto.UUID.cast(id) do
      {:ok, uuid} ->
        case Repo.get_by(Conversation, organization_id: org_id, id: uuid, is_deleted: false) do
          nil ->
            Repo.get_by(Conversation, organization_id: org_id, app_context: id, is_deleted: false)

          conv ->
            conv
        end

      :error ->
        Repo.get_by(Conversation, organization_id: org_id, app_context: id, is_deleted: false)
    end
  end

  def get_or_create(org_id, user_id, agent_id, app_context) do
    org_id = normalize_org_id(org_id)
    user_id = normalize_user_id(user_id)

    case Repo.get_by(Conversation,
           organization_id: org_id,
           user_id: user_id,
           agent_id: agent_id,
           app_context: app_context,
           is_deleted: false
         ) do
      nil ->
        case %Conversation{}
             |> Conversation.changeset(%{
               organization_id: org_id,
               user_id: user_id,
               agent_id: agent_id,
               app_context: app_context,
               title: "Nueva conversación"
             })
             |> Repo.insert() do
          {:ok, conv} -> conv
          {:error, _} -> raise "Failed to create conversation"
        end

      conv ->
        conv
    end
  end

  def soft_delete(org_id, id) do
    org_id = normalize_org_id(org_id)

    case get(org_id, id) do
      nil ->
        {:error, :not_found}

      conv ->
        Repo.update(
          Conversation.changeset(conv, %{is_deleted: true, deleted_at: DateTime.utc_now()})
        )
    end
  end

  def list_messages(conv_id, limit \\ 100) do
    case Ecto.UUID.cast(conv_id) do
      {:ok, uuid} ->
        Repo.all(
          from(m in Message,
            where: m.conversation_id == ^uuid,
            order_by: [asc: m.created_at],
            limit: ^limit
          )
        )

      :error ->
        []
    end
  end

  def add_message(conv_id, attrs) do
    case Ecto.UUID.cast(conv_id) do
      {:ok, uuid} ->
        params =
          case attrs do
            map when is_map(map) ->
              if Enum.any?(Map.keys(map), &is_binary/1) do
                Map.put(map, "conversation_id", uuid)
              else
                Map.put(map, :conversation_id, uuid)
              end

            _ ->
              attrs
          end

        result =
          %Message{}
          |> Message.changeset(params)
          |> Repo.insert()

        case result do
          {:ok, _msg} ->
            Repo.update_all(
              from(c in Conversation, where: c.id == ^uuid),
              inc: [message_count: 1],
              set: [last_message_at: DateTime.utc_now()]
            )

            role = attrs[:role] || attrs["role"]
            content = attrs[:content] || attrs["content"]

            if role == "user" do
              maybe_update_title(uuid, content)
            end

            :ok

          _ ->
            :ok
        end

        result

      :error ->
        {:error, :invalid_conversation_id}
    end
  end

  defp maybe_update_title(conv_id, content) when is_binary(content) do
    title = content |> String.slice(0, 80) |> String.trim()

    if title != "" do
      Repo.update_all(
        from(c in Conversation,
          where: c.id == ^conv_id and c.title == "Nueva conversación"
        ),
        set: [title: title]
      )
    end
  end

  defp maybe_update_title(_conv_id, _content), do: :ok

  defp normalize_user_id("user_" <> id), do: id
  defp normalize_user_id(id), do: id

  defp normalize_org_id("org_" <> id), do: id
  defp normalize_org_id(id), do: id
end
