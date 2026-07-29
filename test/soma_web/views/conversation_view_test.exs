defmodule SomaWeb.ConversationViewTest do
  use ExUnit.Case, async: true

  alias Soma.Conversation
  alias SomaWeb.ConversationView

  describe "conversation_json/1" do
    test "maps snake_case Ecto fields to camelCase" do
      now = ~U[2025-01-01T00:00:00Z]
      conv = %Conversation{
        id: "abc-123",
        organization_id: "org-1",
        user_id: "user-1",
        agent_id: "agent-1",
        app_context: "chat",
        title: "Test conversation",
        last_message_at: now,
        message_count: 5,
        inserted_at: now,
        updated_at: now
      }

      result = ConversationView.conversation_json(conv)

      assert result.id == "abc-123"
      assert result.organizationId == "org-1"
      assert result.userId == "user-1"
      assert result.agentId == "agent-1"
      assert result.appContext == "chat"
      assert result.title == "Test conversation"
      assert result.lastMessageAt == now
      assert result.messageCount == 5
      assert result.insertedAt == now
      assert result.updatedAt == now
    end

    test "excludes snake_case keys from output" do
      conv = %Conversation{
        id: "x",
        organization_id: "org",
        user_id: "u",
        agent_id: "a",
        app_context: "c",
        title: "t",
        last_message_at: nil,
        message_count: 0,
        inserted_at: ~U[2025-01-01T00:00:00Z],
        updated_at: ~U[2025-01-01T00:00:00Z]
      }

      result = ConversationView.conversation_json(conv)

      refute Map.has_key?(result, :agent_id)
      refute Map.has_key?(result, :organization_id)
      refute Map.has_key?(result, :user_id)
      refute Map.has_key?(result, :app_context)
      refute Map.has_key?(result, :last_message_at)
      refute Map.has_key?(result, :message_count)
      refute Map.has_key?(result, :inserted_at)
      refute Map.has_key?(result, :updated_at)
    end

    test "excludes internal soft-delete fields" do
      conv = %Conversation{
        id: "x",
        organization_id: "org",
        user_id: "u",
        agent_id: "a",
        app_context: "c",
        title: "t",
        last_message_at: nil,
        message_count: 0,
        inserted_at: ~U[2025-01-01T00:00:00Z],
        updated_at: ~U[2025-01-01T00:00:00Z],
        is_deleted: true,
        deleted_at: ~U[2025-01-01T00:00:00Z]
      }

      result = ConversationView.conversation_json(conv)

      refute Map.has_key?(result, :isDeleted)
      refute Map.has_key?(result, :is_deleted)
      refute Map.has_key?(result, :deletedAt)
      refute Map.has_key?(result, :deleted_at)
    end

    test "handles nil last_message_at gracefully" do
      conv = %Conversation{
        id: "x",
        organization_id: "org",
        user_id: "u",
        agent_id: "a",
        app_context: "c",
        title: "t",
        last_message_at: nil,
        message_count: 0,
        inserted_at: ~U[2025-01-01T00:00:00Z],
        updated_at: ~U[2025-01-01T00:00:00Z]
      }

      result = ConversationView.conversation_json(conv)

      assert result.lastMessageAt == nil
      assert result.messageCount == 0
    end
  end

  describe "render/2" do
    test "index.json wraps list with data and total" do
      conv = %Conversation{
        id: "a",
        organization_id: "org",
        user_id: "u",
        agent_id: "ag",
        app_context: "c",
        title: "t",
        last_message_at: nil,
        message_count: 0,
        inserted_at: ~U[2025-01-01T00:00:00Z],
        updated_at: ~U[2025-01-01T00:00:00Z]
      }

      result = ConversationView.render("index.json", %{conversations: [conv]})

      assert result.total == 1
      assert length(result.data) == 1
      assert hd(result.data).agentId == "ag"
    end

    test "show.json includes conversation fields plus messages" do
      conv = %Conversation{
        id: "a",
        organization_id: "org",
        user_id: "u",
        agent_id: "ag",
        app_context: "c",
        title: "t",
        last_message_at: nil,
        message_count: 0,
        inserted_at: ~U[2025-01-01T00:00:00Z],
        updated_at: ~U[2025-01-01T00:00:00Z]
      }

      msg = %Soma.Message{
        id: "m1",
        conversation_id: conv.id,
        role: "user",
        content: "hello",
        thinking: nil,
        tools: nil,
        created_at: ~U[2025-01-01T00:00:00Z]
      }

      result = ConversationView.render("show.json", %{conversation: conv, messages: [msg]})

      assert result.agentId == "ag"
      assert result.lastMessageAt == nil
      assert result.messageCount == 0
      assert length(result.messages) == 1
      assert hd(result.messages).role == "user"
    end
  end
end
