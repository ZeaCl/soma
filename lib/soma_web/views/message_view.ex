defmodule SomaWeb.MessageView do
  @moduledoc "Serializa messages a camelCase para la API JSON."

  @doc "Convierte un struct %Message{} a mapa camelCase."
  def message_json(msg) do
    %{
      id: msg.id,
      conversationId: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      thinking: msg.thinking,
      tools: msg.tools,
      createdAt: msg.created_at
    }
  end
end
