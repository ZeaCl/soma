defmodule Soma.Repo.Migrations.CreateCliSkills do
  use Ecto.Migration

  def change do
    create table(:cli_skills, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :organization_id, :uuid, null: false
      add :name, :string, null: false
      add :cli_binary, :string, null: false
      add :version, :string
      add :install_method, :string, null: false
      add :install_spec, :map, null: false
      add :skill_content, :text, null: false
      add :required_secrets, {:array, :string}, default: []
      add :env_mapping, :map, default: %{}
      add :config_files, :map, default: %{}
      add :post_install_cmd, :text
      add :health_check_cmd, :string
      add :is_active, :boolean, default: true, null: false
      add :is_builtin, :boolean, default: false, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:cli_skills, [:organization_id, :name])
  end
end
