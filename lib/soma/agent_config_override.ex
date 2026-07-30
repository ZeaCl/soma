defmodule Soma.AgentConfigOverride do
  @moduledoc "Schema para agent_config_overrides — configuraciones locales por agente/app."
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "agent_config_overrides" do
    field(:organization_id, Ecto.UUID)
    field(:agent_id, :string)
    field(:app_context, :string)
    field(:engine, :string, default: "pi")
    field(:system_prompt_override, :string)
    field(:workspace_paths, {:array, :string})
    timestamps(type: :utc_datetime)
  end

  def changeset(override, attrs) do
    override
    |> cast(attrs, [
      :organization_id,
      :agent_id,
      :app_context,
      :engine,
      :system_prompt_override,
      :workspace_paths
    ])
    |> validate_required([:organization_id, :agent_id, :app_context])
  end
end
