defmodule Soma.ConversationsTest do
  use ExUnit.Case, async: false

  alias Soma.{Repo, Conversations}

  @org "00000000-0000-0000-0000-000000000001"
  @org2 "00000000-0000-0000-0000-000000000002"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Repo, {:shared, self()})
    :ok
  end

  test "list returns empty for new org" do
    convs = Conversations.list(@org, "user-1")
    assert convs == []
  end

  test "get_or_create creates new conversation" do
    conv = Conversations.get_or_create(@org, "user-2", "agent-1", "sudlich-app")
    assert conv.title == "Nueva conversación"
    assert conv.organization_id == @org
  end

  test "get_or_create returns same conversation on second call" do
    first = Conversations.get_or_create(@org, "user-3", "agent-2", "app-x")
    second = Conversations.get_or_create(@org, "user-3", "agent-2", "app-x")
    assert first.id == second.id
  end

  test "add_message persists and is retrievable" do
    conv = Conversations.get_or_create(@org, "user-4", "agent-3", "app-y")
    {:ok, msg} = Conversations.add_message(conv.id, %{role: "user", content: "hello"})
    assert msg.role == "user"
    assert msg.content == "hello"

    messages = Conversations.list_messages(conv.id)
    assert length(messages) == 1
    assert hd(messages).content == "hello"
  end

  test "soft_delete marks as deleted and excludes from list" do
    conv = Conversations.get_or_create(@org2, "user-5", "agent-4", "app-z")
    {:ok, deleted} = Conversations.soft_delete(@org2, conv.id)
    assert deleted.is_deleted

    convs = Conversations.list(@org2, "user-5")
    refute Enum.any?(convs, &(&1.id == conv.id))
  end

  # ── list_messages_page/2 ─────────────────────────────────────────────

  test "list_messages_page returns oldest-to-newest and paginates backwards" do
    conv = Conversations.get_or_create(@org, "user-page", "agent-page", "app-page")

    for i <- 1..5 do
      ts = DateTime.new!(~D[2026-01-01], Time.new!(0, i, 0))

      {:ok, _} =
        Conversations.add_message(conv.id, %{
          role: "user",
          content: "m#{i}",
          created_at: ts
        })
    end

    # Primera página: los 2 más recientes (m4, m5), en orden ascendente
    page1 = Conversations.list_messages_page(conv.id, limit: 2)
    assert page1.has_more
    assert Enum.map(page1.messages, & &1.content) == ["m4", "m5"]
    assert page1.next_cursor == List.first(page1.messages).id

    # Segunda página: hacia atrás desde el cursor (m2, m3)
    page2 = Conversations.list_messages_page(conv.id, limit: 2, before: page1.next_cursor)
    assert Enum.map(page2.messages, & &1.content) == ["m2", "m3"]

    # Tercera página: queda m1, sin más
    page3 = Conversations.list_messages_page(conv.id, limit: 2, before: page2.next_cursor)
    assert Enum.map(page3.messages, & &1.content) == ["m1"]
    refute page3.has_more
    assert page3.next_cursor == nil
  end

  test "list_messages_page without before returns the newest page" do
    conv = Conversations.get_or_create(@org, "user-page2", "agent-page2", "app-page2")

    for i <- 1..3 do
      ts = DateTime.new!(~D[2026-02-01], Time.new!(0, i, 0))

      {:ok, _} =
        Conversations.add_message(conv.id, %{
          role: "user",
          content: "n#{i}",
          created_at: ts
        })
    end

    page = Conversations.list_messages_page(conv.id, limit: 10)
    assert Enum.map(page.messages, & &1.content) == ["n1", "n2", "n3"]
    refute page.has_more
  end

  test "list_messages_page returns empty for invalid conversation id" do
    assert %{messages: [], has_more: false, next_cursor: nil} =
             Conversations.list_messages_page("not-a-uuid")
  end
end
