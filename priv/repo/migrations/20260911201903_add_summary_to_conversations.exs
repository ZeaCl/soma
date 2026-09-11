defmodule Soma.Repo.Migrations.AddSummaryToConversations do
  use Ecto.Migration

  def change do
    alter table(:conversations) do
      add :summary, :text
      add :summary_covers_up_to, :binary_id
    end
  end
end
