defmodule Soma.CustomSkill do
  @moduledoc "Custom skill schema — skills definidos por el usuario por organización."
  use Ecto.Schema
  import Ecto.Changeset

  @derive {Jason.Encoder,
           only: [:id, :organization_id, :name, :content, :is_active, :inserted_at, :updated_at]}

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "custom_skills" do
    field(:organization_id, Ecto.UUID)
    field(:name, :string)
    field(:content, :string)
    field(:is_active, :boolean, default: true)
    timestamps(type: :utc_datetime)
  end

  def changeset(skill, attrs) do
    skill
    |> cast(attrs, [:organization_id, :name, :content, :is_active])
    |> validate_required([:organization_id, :name, :content])
  end
end
