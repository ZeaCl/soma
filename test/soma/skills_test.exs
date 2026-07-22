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

  # ── list/1 ───────────────────────────────────────────────────────────

  test "list/1 with nil returns builtin skills" do
    skills = Skills.list(nil)
    assert is_list(skills)
  end

  # ── list_agents ──────────────────────────────────────────────────────

  test "list_agents/1 returns agents" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:get_user, "t"} => {:ok, [%{"id" => "a1", "name" => "Bot"}]}
    })

    assert {:ok, agents} = Skills.list_agents("t")
    assert length(agents) == 1
  end

  test "list_agents/0 returns empty on error" do
    Soma.ThalamusClient.Mock.set_responses(%{{:get_user, nil} => {:ok, []}})
    assert {:ok, []} = Skills.list_agents()
  end

  # ── Agent CRUD ───────────────────────────────────────────────────────

  test "get_agent/1" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:get_user_by_id, "a1"} => {:ok, %{"id" => "a1", "name" => "T"}}
    })

    assert {:ok, %{"name" => "T"}} = Skills.get_agent("a1")
  end

  test "get_agent/1 not found" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:get_user_by_id, "x"} => {:error, :not_found}
    })

    assert {:error, :not_found} = Skills.get_agent("x")
  end

  test "delete_agent/1" do
    Soma.ThalamusClient.Mock.set_responses(%{{:delete_user, "a1"} => :ok})
    assert :ok = Skills.delete_agent("a1")
  end

  test "update_agent_config/2" do
    cfg = %{"system_prompt" => "hi", "engine" => "pi"}

    Soma.ThalamusClient.Mock.set_responses(%{
      {:update_user, "a1"} => {:ok, cfg}
    })

    assert {:ok, ^cfg} = Skills.update_agent_config("a1", cfg)
  end

  test "create_agent/3" do
    Soma.ThalamusClient.Mock.set_responses(%{
      {:create_user, nil} => {:ok, %{"id" => "new", "agent_config" => %{}}}
    })

    assert {:ok, %{"id" => "new"}} = Skills.create_agent("org1", %{"email" => "a@b.com"})
  end

  # ── assign_to_agents ─────────────────────────────────────────────────

  test "assign_to_agents/3 returns assignment" do
    Soma.FileSystem.Mock.set_responses(%{
      {:read, "/app/.pi-agent-skills/.registry.json"} => {:ok, "{}"}
    })

    assert {:ok, %{name: "skill1"}} = Skills.assign_to_agents("o1", "skill1", [])
  end

  # ── load_app_context ─────────────────────────────────────────────────

  test "load_app_context/2 when AGENTS.md exists" do
    Soma.FileSystem.Mock.set_responses(%{
      :exists_default => true,
      {:read!, "/workspace/orgs/o1/app1/AGENTS.md"} => "# App Context"
    })

    assert {:ok, "# App Context"} = Skills.load_app_context("o1", "app1")
  end

  test "load_app_context/2 when AGENTS.md missing" do
    Soma.FileSystem.Mock.set_responses(%{:exists_default => false})

    assert {:ok, nil} = Skills.load_app_context("o1", "missing")
  end
end
