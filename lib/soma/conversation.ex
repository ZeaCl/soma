defmodule Soma.Conversation do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "conversations" do
    field :organization_id, Ecto.UUID
    field :user_id, :string
    field :agent_id, :string
    field :app_context, :string
    field :title, :string
    field :last_message_at, :utc_datetime
    field :message_count, :integer, default: 0
    field :is_deleted, :boolean, default: false
    field :deleted_at, :utc_datetime
    timestamps(type: :utc_datetime)
  end

  def changeset(conv, attrs) do
    conv
    |> cast(attrs, [:organization_id, :user_id, :agent_id, :app_context, :title, :last_message_at, :message_count, :is_deleted, :deleted_at])
    |> validate_required([:organization_id, :user_id, :agent_id, :app_context])
  end
end
