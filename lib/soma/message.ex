defmodule Soma.Message do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "messages" do
    field(:conversation_id, :binary_id)
    field(:role, :string)
    field(:content, :string)
    field(:thinking, :string)
    field(:tools, :map)
    field(:created_at, :utc_datetime)
  end

  def changeset(msg, attrs) do
    msg
    |> cast(attrs, [:conversation_id, :role, :content, :thinking, :tools, :created_at])
    |> validate_required([:conversation_id, :role, :content])
    |> validate_inclusion(:role, ["user", "assistant", "system"])
  end
end
