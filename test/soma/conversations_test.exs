defmodule Soma.ConversationsTest do
  use ExUnit.Case, async: false

  alias Soma.{Repo, Conversations}

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
  end

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Repo, {:shared, self()})
    :ok
  end

  test "list returns empty for new org" do
    convs = Conversations.list("org-nonexistent", "user-1")
    assert convs == []
  end

  test "get_or_create creates new conversation" do
    conv = Conversations.get_or_create("org-test-z", "user-2", "agent-1", "sudlich-app")
    assert conv.title == "Nueva conversación"
    assert conv.organization_id == "org-test-z"
  end

  test "get_or_create returns same conversation on second call" do
    first = Conversations.get_or_create("org-test-y", "user-3", "agent-2", "app-x")
    second = Conversations.get_or_create("org-test-y", "user-3", "agent-2", "app-x")
    assert first.id == second.id
  end

  test "add_message persists and is retrievable" do
    conv = Conversations.get_or_create("org-msg-z", "user-4", "agent-3", "app-y")
    {:ok, msg} = Conversations.add_message(conv.id, %{role: "user", content: "hello"})
    assert msg.role == "user"
    assert msg.content == "hello"

    messages = Conversations.list_messages(conv.id)
    assert length(messages) == 1
    assert hd(messages).content == "hello"
  end

  test "soft_delete marks as deleted and excludes from list" do
    conv = Conversations.get_or_create("org-del-y", "user-5", "agent-4", "app-z")
    {:ok, deleted} = Conversations.soft_delete("org-del-y", conv.id)
    assert deleted.is_deleted

    convs = Conversations.list("org-del-y", "user-5")
    refute Enum.any?(convs, &(&1.id == conv.id))
  end
end
