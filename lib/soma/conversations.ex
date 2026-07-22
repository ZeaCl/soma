defmodule Soma.Conversations do
  import Ecto.Query
  alias Soma.{Repo, Conversation, Message}

  def list(org_id, user_id) do
    Repo.all(
      from(c in Conversation,
        where: c.organization_id == ^org_id and c.user_id == ^user_id and c.is_deleted == false,
        order_by: [desc: c.last_message_at]
      )
    )
  end

  def get(org_id, id) do
    Repo.get_by(Conversation, organization_id: org_id, id: id, is_deleted: false)
  end

  def get_or_create(org_id, user_id, agent_id, app_context) do
    case Repo.get_by(Conversation,
           organization_id: org_id,
           user_id: user_id,
           agent_id: agent_id,
           app_context: app_context,
           is_deleted: false
         ) do
      nil ->
        %Conversation{}
        |> Conversation.changeset(%{
          organization_id: org_id,
          user_id: user_id,
          agent_id: agent_id,
          app_context: app_context,
          title: "Nueva conversación"
        })
        |> Repo.insert!()

      conv ->
        conv
    end
  end

  def soft_delete(org_id, id) do
    case Repo.get_by(Conversation, organization_id: org_id, id: id) do
      nil ->
        {:error, :not_found}

      conv ->
        Repo.update(
          Conversation.changeset(conv, %{is_deleted: true, deleted_at: DateTime.utc_now()})
        )
    end
  end

  def list_messages(conv_id, limit \\ 100) do
    Repo.all(
      from(m in Message,
        where: m.conversation_id == ^conv_id,
        order_by: [asc: m.created_at],
        limit: ^limit
      )
    )
  end

  def add_message(conv_id, attrs) do
    %Message{}
    |> Message.changeset(Map.put(attrs, :conversation_id, conv_id))
    |> Repo.insert()
  end
end
