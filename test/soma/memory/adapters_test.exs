defmodule Soma.Memory.AdaptersTest do
  use ExUnit.Case, async: false

  alias Soma.Memory
  alias Soma.Memory.Adapter
  alias Soma.Memory.Adapters.{Pi, Opencode, ClaudeCode, Glia}
  alias Soma.Conversations

  @org_id "00000000-0000-0000-0000-000000000001"
  @user_id "test-user-adapters-01"
  @agent_id "test-agent-adapters-01"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Soma.Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Soma.Repo, {:shared, self()})

    Application.put_env(:soma, :file_system, Soma.FileSystem.Mock)
    Soma.FileSystem.Mock.start_link(%{})

    conv = Conversations.get_or_create(@org_id, @user_id, @agent_id, "test_adapters_context")

    on_exit(fn ->
      Application.delete_env(:soma, :file_system)
    end)

    {:ok, conv: conv}
  end

  describe "Adapter.for_runtime/1" do
    test "resolves supported runtimes correctly" do
      assert {:ok, Pi} = Adapter.for_runtime("pi")
      assert {:ok, Pi} = Adapter.for_runtime(:pi)

      assert {:ok, Opencode} = Adapter.for_runtime("opencode")
      assert {:ok, Opencode} = Adapter.for_runtime(:opencode)

      assert {:ok, ClaudeCode} = Adapter.for_runtime("claude-code")
      assert {:ok, ClaudeCode} = Adapter.for_runtime(:claude_code)

      assert {:ok, Glia} = Adapter.for_runtime("glia")
      assert {:ok, Glia} = Adapter.for_runtime(:glia)

      assert {:error, {:unknown_runtime, "unsupported"}} = Adapter.for_runtime("unsupported")
    end
  end

  describe "Pi adapter" do
    test "writes context bundle to ~/.pi/agent/context/<conv_id>.json", %{conv: conv} do
      bundle = %{"conversationId" => conv.id, "summary" => "Test summary", "messages" => []}
      home = "/home/soma-agent-pi"

      assert {:ok, path} = Pi.inject_context(home, conv.id, bundle, fs: Soma.FileSystem.Mock)
      assert path == Path.join([home, ".pi", "agent", "context", "#{conv.id}.json"])

      writes = Soma.FileSystem.Mock.writes()
      written = Enum.find(writes, fn {p, _} -> p == path end)
      assert written != nil

      {_, content} = written
      assert {:ok, decoded} = Jason.decode(content)
      assert decoded["summary"] == "Test summary"
    end
  end

  describe "Opencode adapter" do
    test "writes context file and updates AGENTS.md", %{conv: conv} do
      bundle = %{
        "conversationId" => conv.id,
        "summary" => "Opencode rolling summary",
        "messages" => [
          %{"role" => "user", "content" => "How do I setup the project?"},
          %{"role" => "assistant", "content" => "Run mix setup"}
        ]
      }

      home = "/home/soma-agent-opencode"

      assert {:ok, path} =
               Opencode.inject_context(home, conv.id, bundle, fs: Soma.FileSystem.Mock)

      assert path == Path.join([home, ".opencode", "context", "#{conv.id}.json"])

      writes = Soma.FileSystem.Mock.writes()
      agents_md_write = Enum.find(writes, fn {p, _} -> p == Path.join(home, "AGENTS.md") end)
      assert agents_md_write != nil

      {_, agents_content} = agents_md_write
      assert String.contains?(agents_content, "<!-- SOMA_CONTEXT_START: #{conv.id} -->")
      assert String.contains?(agents_content, "Opencode rolling summary")
      assert String.contains?(agents_content, "How do I setup the project?")
      assert String.contains?(agents_content, "<!-- SOMA_CONTEXT_END -->")
    end

    test "replaces existing context block in AGENTS.md without duplicating", %{conv: conv} do
      home = "/home/soma-agent-opencode"
      agents_path = Path.join(home, "AGENTS.md")

      existing = """
      # Agent Guidelines
      Always be concise.

      <!-- SOMA_CONTEXT_START: #{conv.id} -->
      Old summary
      <!-- SOMA_CONTEXT_END -->
      """

      Soma.FileSystem.Mock.set_responses(%{
        {:read, agents_path} => {:ok, existing}
      })

      bundle = %{"conversationId" => conv.id, "summary" => "Brand new summary", "messages" => []}
      assert {:ok, _} = Opencode.inject_context(home, conv.id, bundle, fs: Soma.FileSystem.Mock)

      writes = Soma.FileSystem.Mock.writes()
      agents_md_write = Enum.find(writes, fn {p, _} -> p == agents_path end)
      assert agents_md_write != nil

      {_, content} = agents_md_write
      assert String.contains?(content, "# Agent Guidelines")
      assert String.contains?(content, "Brand new summary")
      refute String.contains?(content, "Old summary")
    end
  end

  describe "ClaudeCode adapter" do
    test "writes context file and updates CLAUDE.md", %{conv: conv} do
      bundle = %{
        "conversationId" => conv.id,
        "summary" => "Claude code summary",
        "messages" => []
      }

      home = "/home/soma-agent-claude"

      assert {:ok, path} =
               ClaudeCode.inject_context(home, conv.id, bundle, fs: Soma.FileSystem.Mock)

      assert path == Path.join([home, ".claude", "context", "#{conv.id}.json"])

      writes = Soma.FileSystem.Mock.writes()
      claude_md_write = Enum.find(writes, fn {p, _} -> p == Path.join(home, "CLAUDE.md") end)
      assert claude_md_write != nil

      {_, claude_content} = claude_md_write
      assert String.contains?(claude_content, "<!-- SOMA_CONTEXT_START: #{conv.id} -->")
      assert String.contains?(claude_content, "Claude code summary")
      assert String.contains?(claude_content, "<!-- SOMA_CONTEXT_END -->")
    end
  end

  describe "Glia adapter" do
    test "writes json file when home path is provided", %{conv: conv} do
      bundle = %{
        "conversationId" => conv.id,
        "summary" => "Glia ReAct summary",
        "messages" => [%{"role" => "user", "content" => "Hello Glia"}]
      }

      home = "/home/soma-agent-glia"

      assert {:ok, result} = Glia.inject_context(home, conv.id, bundle, fs: Soma.FileSystem.Mock)
      assert result.file == Path.join([home, ".glia", "context", "#{conv.id}.json"])
      assert is_map(result.glia_state)
      assert result.glia_state.summary == "Glia ReAct summary"
      assert length(result.glia_state.messages) == 2
    end

    test "in-memory update for Glia Agent State", %{conv: conv} do
      bundle = %{
        "conversationId" => conv.id,
        "summary" => "State summary",
        "messages" => [
          %{"role" => "user", "content" => "Pregunta sobre nutrición"}
        ]
      }

      current_state = %{id: "agent-123", messages: []}

      assert {:ok, new_state} = Glia.inject_context(current_state, conv.id, bundle)
      assert new_state.id == "agent-123"
      assert length(new_state.messages) == 2
      assert hd(new_state.messages).role == "system"
      assert hd(new_state.messages).content =~ "State summary"
      assert List.last(new_state.messages).role == "user"
      assert List.last(new_state.messages).content == "Pregunta sobre nutrición"
    end
  end

  describe "Soma.Memory.inject_context/5 & inspect_context/2" do
    test "Memory.inject_context/5 delegates to matched adapter", %{conv: conv} do
      bundle = %{"conversationId" => conv.id, "summary" => "Summary via memory", "messages" => []}
      home = "/home/soma-agent-generic"

      assert {:ok, _} =
               Memory.inject_context(:pi, home, conv.id, bundle, fs: Soma.FileSystem.Mock)

      assert {:ok, _} =
               Memory.inject_context("opencode", home, conv.id, bundle, fs: Soma.FileSystem.Mock)

      assert {:ok, _} =
               Memory.inject_context(:claude_code, home, conv.id, bundle,
                 fs: Soma.FileSystem.Mock
               )

      assert {:ok, _} =
               Memory.inject_context("glia", home, conv.id, bundle, fs: Soma.FileSystem.Mock)

      assert {:error, {:unknown_runtime, "invalid"}} =
               Memory.inject_context("invalid", home, conv.id, bundle)
    end

    test "Memory.inspect_context/2 returns high-level context overview for glia-web / dashboards",
         %{conv: conv} do
      Conversations.add_message(conv.id, %{role: "user", content: "Mensaje 1"})
      Conversations.add_message(conv.id, %{role: "assistant", content: "Mensaje 2"})

      {:ok, info} = Memory.inspect_context(conv.id)
      assert info.conversation_id == conv.id
      assert info.has_summary == false
      assert info.message_count >= 2

      Conversations.update_summary(conv.id, "Resumen consolidado", nil)

      {:ok, info_with_summary} = Memory.inspect_context(conv.id)
      assert info_with_summary.has_summary == true
      assert info_with_summary.summary == "Resumen consolidado"
      assert info_with_summary.estimated_tokens > 0
    end
  end
end
