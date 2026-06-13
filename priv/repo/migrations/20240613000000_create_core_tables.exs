defmodule Soma.Repo.Migrations.CreateCoreTables do
  use Ecto.Migration

  def change do
    create table(:conversations, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :organization_id, :uuid, null: false
      add :user_id, :string, null: false
      add :agent_id, :string, null: false
      add :app_context, :string, null: false
      add :title, :string
      add :last_message_at, :utc_datetime, default: fragment("now()")
      add :message_count, :integer, default: 0
      add :is_deleted, :boolean, default: false
      add :deleted_at, :utc_datetime
      timestamps()
    end
    create index(:conversations, [:organization_id])
    create index(:conversations, [:organization_id, :user_id])

    create table(:messages, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :conversation_id, references(:conversations, type: :binary_id, on_delete: :delete_all), null: false
      add :role, :string, null: false
      add :content, :text, null: false
      add :thinking, :text
      add :tools, :map
      add :created_at, :utc_datetime, default: fragment("now()")
    end
    create index(:messages, [:conversation_id, :created_at])

    create table(:custom_skills, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :organization_id, :uuid, null: false
      add :name, :string, null: false
      add :content, :text, null: false
      add :is_active, :boolean, default: true
      timestamps()
    end
    create unique_index(:custom_skills, [:organization_id, :name])

    create table(:api_keys, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :organization_id, :uuid, null: false
      add :name, :string, null: false
      add :key_hash, :string, null: false
      add :key_prefix, :string, null: false
      add :scopes, {:array, :string}, default: []
      add :is_active, :boolean, default: true
      add :last_used_at, :utc_datetime
      add :expires_at, :utc_datetime
      add :revoked_at, :utc_datetime
      timestamps()
    end
    create unique_index(:api_keys, [:key_hash])

    create table(:agent_config_overrides, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :organization_id, :uuid, null: false
      add :agent_id, :string, null: false
      add :app_context, :string, null: false
      add :engine, :string, default: "pi"
      add :system_prompt_override, :text
      add :workspace_paths, {:array, :string}
      timestamps()
    end
    create unique_index(:agent_config_overrides, [:organization_id, :agent_id, :app_context])
  end
end
