defmodule Soma.Repo do
  use Ecto.Repo, otp_app: :soma, adapter: Ecto.Adapters.Postgres
end
