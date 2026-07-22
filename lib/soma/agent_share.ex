defmodule Soma.AgentShare do
  @moduledoc "Schema para compartir agentes entre usuarios (Google Drive model)."
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "agent_shares" do
    field(:agent_id, :string)
    field(:shared_with_user_id, :string)
    field(:shared_by_user_id, :string)
    timestamps(updated_at: false)
  end

  def changeset(share, attrs) do
    share
    |> cast(attrs, [:agent_id, :shared_with_user_id, :shared_by_user_id])
    |> validate_required([:agent_id, :shared_with_user_id, :shared_by_user_id])
    |> unique_constraint([:agent_id, :shared_with_user_id])
  end
end
