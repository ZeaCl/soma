defmodule SomaWeb.ConversationView do
  @moduledoc "Serializa conversations a camelCase para la API JSON."

  alias SomaWeb.MessageView

  @doc "GET /api/conversations — lista de conversaciones."
  def render("index.json", %{conversations: convs}) do
    %{data: Enum.map(convs, &conversation_json/1), total: length(convs)}
  end

  def render("show.json", %{conversation: conv, messages: msgs}) do
    %{
      id: conv.id,
      title: conv.title,
      messages: Enum.map(msgs, &MessageView.message_json/1)
    }
  end

  @doc "Convierte un struct %Conversation{} a mapa camelCase."
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
