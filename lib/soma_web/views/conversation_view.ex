defmodule SomaWeb.ConversationView do
  @moduledoc "Serializa conversations a camelCase para la API JSON."

  alias SomaWeb.MessageView

  @doc "GET /api/conversations — lista de conversaciones."
  def render("index.json", %{conversations: convs}) do
    %{data: Enum.map(convs, &conversation_json/1), total: length(convs)}
  end

  def render("show.json", %{conversation: conv, messages: msgs}) do
    conversation_json(conv)
    |> Map.put(:messages, Enum.map(msgs, &MessageView.message_json/1))
  end

  @doc "Convierte un struct %Conversation{} a mapa camelCase."
  @doc since: "0.3.0"
  # NOTA: is_deleted y deleted_at se excluyen intencionalmente —
  # son campos internos de soft-delete, no parte del API contract.
  def conversation_json(conv) do
    %{
      id: conv.id,
      organizationId: conv.organization_id,
      userId: conv.user_id,
      agentId: conv.agent_id,
      appContext: conv.app_context,
      title: conv.title,
      lastMessageAt: conv.last_message_at,
      messageCount: conv.message_count,
      insertedAt: conv.inserted_at,
      updatedAt: conv.updated_at
    }
  end
end
