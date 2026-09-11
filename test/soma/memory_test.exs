defmodule Soma.MemoryTest do
  use ExUnit.Case, async: false

  alias Soma.Memory
  alias Soma.Conversations

  @org_id "00000000-0000-0000-0000-000000000001"
  @user_id "test-user-memory-01"
  @agent_id "test-agent-memory-01"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Soma.Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Soma.Repo, {:shared, self()})

    Application.put_env(:soma, :file_system, Soma.FileSystem.Mock)
    Soma.FileSystem.Mock.start_link(%{})

    # Limpiar o preparar conversación de prueba en la base de datos
    conv = Conversations.get_or_create(@org_id, @user_id, @agent_id, "test_memory_context")

    on_exit(fn ->
      Application.delete_env(:soma, :file_system)
    end)

    {:ok, conv: conv}
  end

  test "build_context/2 builds structured bundle from Postgres messages", %{conv: conv} do
    Conversations.add_message(conv.id, %{role: "user", content: "Hola, tengo una pregunta sobre mi dieta"})
    Conversations.add_message(conv.id, %{role: "assistant", content: "¡Hola! Dime qué necesitas saber", thinking: "pensando respuesta inicial"})

    {:ok, bundle} = Memory.build_context(conv.id, system_prompt: "Eres un asistente nutricional")

    assert bundle["conversationId"] == conv.id
    assert bundle["systemPrompt"] == "Eres un asistente nutricional"
    assert is_list(bundle["messages"])
    assert length(bundle["messages"]) >= 2

    last_user = Enum.find(bundle["messages"], &(&1["role"] == "user" && String.contains?(&1["content"], "dieta")))
    assert last_user != nil

    last_assistant = Enum.find(bundle["messages"], &(&1["role"] == "assistant" && String.contains?(&1["content"], "necesitas saber")))
    assert last_assistant != nil
    assert last_assistant["thinking"] == "pensando respuesta inicial"

    assert bundle["budget"]["maxTokens"] == 120_000
    assert bundle["budget"]["estimatedTokens"] > 0
  end

  test "write_context_file/4 creates directory and writes json bundle file", %{conv: conv} do
    bundle = %{
      "conversationId" => conv.id,
      "systemPrompt" => "System prompt",
      "messages" => []
    }

    home = "/home/soma-test-agent"
    assert :ok == Memory.write_context_file(home, conv.id, bundle, Soma.FileSystem.Mock)

    writes = Soma.FileSystem.Mock.writes()
    assert length(writes) >= 1

    expected_path = Path.join([home, ".pi", "agent", "context", "#{conv.id}.json"])
    written = Enum.find(writes, fn {path, _content} -> path == expected_path end)

    assert written != nil
    {_path, json_content} = written
    assert {:ok, decoded} = Jason.decode(json_content)
    assert decoded["conversationId"] == conv.id
  end

  test "build_context/2 handles invalid UUID gracefully" do
    assert {:error, :invalid_conversation_id} == Memory.build_context("invalid-uuid")
  end
end
