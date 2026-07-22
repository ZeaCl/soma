defmodule Soma.ApiKey do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query
  alias Soma.Repo

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "api_keys" do
    field(:name, :string)
    field(:key_hash, :string)
    field(:key_prefix, :string)
    field(:scopes, {:array, :string}, default: [])
    field(:is_active, :boolean, default: true)
    field(:last_used_at, :utc_datetime)
    field(:expires_at, :utc_datetime)
    field(:revoked_at, :utc_datetime)
    field(:organization_id, Ecto.UUID)
    timestamps(type: :utc_datetime)
  end

  def changeset(key, attrs) do
    key
    |> cast(attrs, [
      :name,
      :key_hash,
      :key_prefix,
      :scopes,
      :is_active,
      :organization_id,
      :expires_at
    ])
    |> validate_required([:name, :key_hash, :key_prefix, :organization_id])
  end

  def touch_last_used(%__MODULE__{id: id}) do
    {1, _} =
      Repo.update_all(
        from(k in Soma.ApiKey, where: k.id == ^id),
        set: [last_used_at: DateTime.utc_now()]
      )

    :ok
  end
end
