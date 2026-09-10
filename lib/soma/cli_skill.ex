defmodule Soma.CliSkill do
  @moduledoc "Schema para cli_skills — CLIs instalables en sandboxes de agentes."
  use Ecto.Schema
  import Ecto.Changeset

  @derive {Jason.Encoder,
           only: [
             :id,
             :organization_id,
             :name,
             :cli_binary,
             :version,
             :install_method,
             :install_spec,
             :skill_content,
             :required_secrets,
             :env_mapping,
             :config_files,
             :post_install_cmd,
             :health_check_cmd,
             :is_active,
             :is_builtin,
             :inserted_at,
             :updated_at
           ]}

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "cli_skills" do
    field(:organization_id, Ecto.UUID)
    field(:name, :string)
    field(:cli_binary, :string)
    field(:version, :string)
    field(:install_method, :string)
    field(:install_spec, :map)
    field(:skill_content, :string)
    field(:required_secrets, {:array, :string}, default: [])
    field(:env_mapping, :map, default: %{})
    field(:config_files, :map, default: %{})
    field(:post_install_cmd, :string)
    field(:health_check_cmd, :string)
    field(:is_active, :boolean, default: true)
    field(:is_builtin, :boolean, default: false)
    timestamps(type: :utc_datetime)
  end

  @required_fields [
    :organization_id,
    :name,
    :cli_binary,
    :install_method,
    :install_spec,
    :skill_content
  ]
  @optional_fields [
    :version,
    :required_secrets,
    :env_mapping,
    :config_files,
    :post_install_cmd,
    :health_check_cmd,
    :is_active,
    :is_builtin
  ]

  def changeset(cli_skill, attrs) do
    cli_skill
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:install_method, ~w(apt script binary npm pip))
  end
end
