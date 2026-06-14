defmodule Soma.AgentShares do
  @moduledoc "Agent sharing — Google Drive model."

  import Ecto.Query
  alias Soma.{Repo, AgentShare}

  def share(agent_id, shared_with_user_id, shared_by_user_id) do
    %AgentShare{}
    |> AgentShare.changeset(%{
      agent_id: agent_id,
      shared_with_user_id: shared_with_user_id,
      shared_by_user_id: shared_by_user_id,
    })
    |> Repo.insert(on_conflict: :nothing)
  end

  def unshare(agent_id, shared_with_user_id) do
    case Repo.get_by(AgentShare, agent_id: agent_id, shared_with_user_id: shared_with_user_id) do
      nil -> {:error, :not_found}
      share -> Repo.delete(share)
    end
  end

  def list_shared_with(user_id) do
    Repo.all(from s in AgentShare, where: s.shared_with_user_id == ^user_id)
  end

  def list_shares_for_agent(agent_id) do
    Repo.all(from s in AgentShare, where: s.agent_id == ^agent_id)
  end

  def has_access?(agent_id, user_id) do
    Repo.exists?(from s in AgentShare,
      where: s.agent_id == ^agent_id and s.shared_with_user_id == ^user_id)
  end
end
