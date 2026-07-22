defmodule Soma.SkillsTest do
  use ExUnit.Case, async: false

  alias Soma.Skills

  setup do
    Application.put_env(:soma, :thalamus_client, Soma.ThalamusClient.Mock)
    Application.put_env(:soma, :file_system, Soma.FileSystem.Mock)
    Soma.ThalamusClient.Mock.start_link(%{})
    Soma.FileSystem.Mock.start_link(%{})

    on_exit(fn ->
      Application.delete_env(:soma, :thalamus_client)
      Application.delete_env(:soma, :file_system)
    end)
  end

  # ── list_agents ──────────────────────────────────────────────────────

  test "list_agents/1 returns agents from Thalamus" do
    mock_agents = [
      %{"id" => "agent-1", "name" => "Bot 1", "is_agent" => true},
      %{"id" => "agent-2", "name" => "Bot 2", "is_agent" => true}
    ]

    Soma.ThalamusClient.Mock.set_responses(%{
      {:get_user, "token-123"} => {:ok, mock_agents}
    })

    assert {:ok, agents} = Skills.list_agents("token-123")
    assert length(agents) == 2
  end

  test "list_agents/0 without token returns empty on error" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:get_user, nil} => {:ok, []}
    })

    assert {:ok, []} = Skills.list_agents()
  end

  # ── get_agent ────────────────────────────────────────────────────────

  test "get_agent/1 returns agent from Thalamus" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:get_user_by_id, "agent-1"} => {:ok, %{"id" => "agent-1", "name" => "Test"}}
    })

    assert {:ok, %{"name" => "Test"}} = Skills.get_agent("agent-1")
  end

  test "get_agent/1 returns error when not found" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:get_user_by_id, "missing"} => {:error, :not_found}
    })

    assert {:error, :not_found} = Skills.get_agent("missing")
  end

  # ── delete_agent ─────────────────────────────────────────────────────

  test "delete_agent/1 calls Thalamus" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:delete_user, "agent-1"} => :ok
    })

    assert :ok = Skills.delete_agent("agent-1")
  end

  # ── update_agent_config ──────────────────────────────────────────────

  test "update_agent_config/2 updates config via Thalamus" do
    config = %{"system_prompt" => "You are helpful", "engine" => "pi"}

    Soma.ThalamusClient.Mock.set_responses(%{
      {:update_user, "agent-1"} => {:ok, config}
    })

    assert {:ok, ^config} = Skills.update_agent_config("agent-1", config)
  end

  # ── List skills ──────────────────────────────────────────────────────

  test "list/1 with nil org returns builtin skills" do
    skills = Skills.list(nil)
    assert is_list(skills)
  end

  # ── assign_to_agents ─────────────────────────────────────────────────

  test "assign_to_agents/3 returns assignment structure" do
    result = Skills.assign_to_agents("org-1", "test-skill", ["agent-1", "agent-2"])
    assert {:ok, %{name: "test-skill"}} = result
  end
end
