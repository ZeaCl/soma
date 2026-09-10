defmodule Soma.CliSkillsTest do
  use ExUnit.Case, async: false

  alias Soma.{Repo, CliSkill, CliSkills}

  @org "00000000-0000-0000-0000-000000000001"
  @org2 "00000000-0000-0000-0000-000000000002"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Repo, {:shared, self()})

    Application.put_env(:soma, :file_system, Soma.FileSystem.Mock)
    Soma.FileSystem.Mock.start_link(%{})
    Application.put_env(:soma, :secret_provider, Soma.SecretProvider.Mock)

    on_exit(fn ->
      Application.delete_env(:soma, :file_system)
      Application.delete_env(:soma, :secret_provider)
    end)

    :ok
  end

  defp attrs(overrides \\ %{}) do
    Map.merge(
      %{
        organization_id: @org,
        name: "aws-cli",
        cli_binary: "aws",
        install_method: "script",
        install_spec: %{"commands" => ["echo install"]},
        skill_content: "# AWS Skill\nusa aws s3 ls",
        required_secrets: ["AWS_ACCESS_KEY_ID"],
        env_mapping: %{"AWS_ACCESS_KEY_ID" => "AWS_ACCESS_KEY_ID"}
      },
      overrides
    )
  end

  # ── create / get ─────────────────────────────────────────────────────

  test "create inserts a cli skill with string keys" do
    assert {:ok, %CliSkill{} = skill} = CliSkills.create(attrs())

    assert skill.name == "aws-cli"
    assert skill.organization_id == @org
    assert skill.is_active
    refute skill.is_builtin
  end

  test "create validates required fields" do
    assert {:error, changeset} = CliSkills.create(%{organization_id: @org})
    refute changeset.valid?
  end

  test "create validates install_method inclusion" do
    assert {:error, changeset} = CliSkills.create(attrs(%{install_method: "telepathy"}))
    assert %{install_method: _} = errors_on(changeset)
  end

  test "get returns skill for the same org" do
    {:ok, _} = CliSkills.create(attrs())
    assert {:ok, %CliSkill{name: "aws-cli"}} = CliSkills.get(@org, "aws-cli")
  end

  test "get returns not_found for another org" do
    {:ok, _} = CliSkills.create(attrs())
    assert {:error, :not_found} = CliSkills.get(@org2, "aws-cli")
  end

  # ── list ─────────────────────────────────────────────────────────────

  test "list returns only active skills for the org" do
    {:ok, _} = CliSkills.create(attrs(%{name: "aws-cli"}))
    {:ok, _} = CliSkills.create(attrs(%{name: "gcloud", cli_binary: "gcloud"}))
    {:ok, _} = CliSkills.create(attrs(%{name: "other-org", organization_id: @org2}))

    names = CliSkills.list(@org) |> Enum.map(& &1.name)
    assert "aws-cli" in names
    assert "gcloud" in names
    refute "other-org" in names
  end

  test "list excludes soft-deleted skills" do
    {:ok, _} = CliSkills.create(attrs())
    assert {:ok, _} = CliSkills.delete(@org, "aws-cli")

    assert CliSkills.get(@org, "aws-cli") == {:error, :not_found}
    refute "aws-cli" in (CliSkills.list(@org) |> Enum.map(& &1.name))
  end

  # ── update / delete ──────────────────────────────────────────────────

  test "update modifies an existing skill" do
    {:ok, _} = CliSkills.create(attrs())
    assert {:ok, updated} = CliSkills.update(@org, "aws-cli", %{"version" => "2.0"})
    assert updated.version == "2.0"
  end

  test "update returns not_found for unknown skill" do
    assert {:error, :not_found} = CliSkills.update(@org, "nope", %{"version" => "1"})
  end

  test "delete is a soft-delete" do
    {:ok, skill} = CliSkills.create(attrs())
    assert {:ok, deleted} = CliSkills.delete(@org, "aws-cli")
    assert deleted.id == skill.id
    refute deleted.is_active
    # Sigue en la DB
    assert Repo.get(CliSkill, skill.id)
  end

  # ── list_for_agent / resolve_env_vars ───────────────────────────────

  test "list_for_agent reads cli_skills from agent config.json" do
    config = Jason.encode!(%{"cli_skills" => ["aws-cli", "gcloud"]})
    path = "/home/soma-agent-1/.pi/agent/config.json"
    Soma.FileSystem.Mock.set_responses(%{{:read, path} => {:ok, config}})

    assert CliSkills.list_for_agent("agent-1") == ["aws-cli", "gcloud"]
  end

  test "list_for_agent returns empty when config missing" do
    assert CliSkills.list_for_agent("agent-x") == []
  end

  test "resolve_env_vars maps secrets to env vars for installed skills" do
    {:ok, _} = CliSkills.create(attrs())
    config = Jason.encode!(%{"cli_skills" => ["aws-cli"]})
    path = "/home/soma-agent-1/.pi/agent/config.json"
    Soma.FileSystem.Mock.set_responses(%{{:read, path} => {:ok, config}})

    vars = CliSkills.resolve_env_vars(@org, "user-1", "agent-1")

    assert {"AWS_ACCESS_KEY_ID", "mock-key-aws_access_key_id"} in vars
  end

  test "resolve_env_vars returns empty when no cli skills installed" do
    config = Jason.encode!(%{"cli_skills" => []})
    path = "/home/soma-agent-1/.pi/agent/config.json"
    Soma.FileSystem.Mock.set_responses(%{{:read, path} => {:ok, config}})

    assert CliSkills.resolve_env_vars(@org, "user-1", "agent-1") == []
  end

  defp errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)
  end
end
