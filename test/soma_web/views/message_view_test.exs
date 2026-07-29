defmodule SomaWeb.MessageViewTest do
  use ExUnit.Case, async: true

  alias Soma.Message
  alias SomaWeb.MessageView

  describe "message_json/1" do
    test "maps snake_case Ecto fields to camelCase" do
      now = ~U[2025-07-29T14:00:00Z]
      msg = %Message{
        id: "msg-123",
        conversation_id: "conv-456",
        role: "user",
        content: "Hello world",
        thinking: "Let me think...",
        tools: %{"bash" => "ls"},
        created_at: now
      }

      result = MessageView.message_json(msg)

      assert result.id == "msg-123"
      assert result.conversationId == "conv-456"
      assert result.role == "user"
      assert result.content == "Hello world"
      assert result.thinking == "Let me think..."
      assert result.tools == %{"bash" => "ls"}
      assert result.createdAt == now
    end

    test "excludes snake_case keys from output" do
      msg = %Message{
        id: "x",
        conversation_id: "y",
        role: "user",
        content: "hi",
        thinking: nil,
        tools: nil,
        created_at: ~U[2025-01-01T00:00:00Z]
      }

      result = MessageView.message_json(msg)

      refute Map.has_key?(result, :conversation_id)
      refute Map.has_key?(result, :created_at)
    end

    test "handles nil thinking and tools gracefully" do
      msg = %Message{
        id: "x",
        conversation_id: "y",
        role: "assistant",
        content: "ok",
        thinking: nil,
        tools: nil,
        created_at: ~U[2025-01-01T00:00:00Z]
      }

      result = MessageView.message_json(msg)

      assert result.thinking == nil
      assert result.tools == nil
      assert result.role == "assistant"
    end

    test "preserves tools map as-is" do
      complex_tools = %{
        "bash" => %{"command" => "ls -la", "output" => "total 0"},
        "read" => %{"path" => "/tmp/test", "content" => "data"}
      }

      msg = %Message{
        id: "x",
        conversation_id: "y",
        role: "assistant",
        content: "done",
        thinking: nil,
        tools: complex_tools,
        created_at: ~U[2025-01-01T00:00:00Z]
      }

      result = MessageView.message_json(msg)

      assert result.tools == complex_tools
      assert result.tools["bash"]["command"] == "ls -la"
    end
  end
end
