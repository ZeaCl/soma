defmodule Soma.AgentDashboard do
  @moduledoc """
  Dashboard de agentes — enriquece datos de Thalamus con métricas locales
  (workspace, issue, status, last_action) para el panel de ZEA Studio.
  """
  import Ecto.Query
  alias Soma.Repo
  alias Soma.Conversation

  @doc """
  Lista agentes enriquecidos con datos del dashboard.

  Devuelve `{:ok, [%{id, name, email, workspace, issue, status, last_action}]}`
  """
  def list_agents(token \\ nil, org_id \\ nil) do
    case thalamus_client().get_user(token) do
      {:ok, agents} ->
        agents = agents |> Enum.map(&enrich_agent/1) |> maybe_filter_by_org(org_id)
        {:ok, agents}

      error ->
        error
    end
  end

  defp enrich_agent(agent) do
    agent_id = agent["id"]
    config = agent["agent_config"] || %{}

    workspace = extract_workspace(config, agent_id)
    {issue, _conv_id} = extract_issue(agent_id)
    status = agent["status"] || "unknown"
    last_action = extract_last_action(agent_id)

    %{
      id: agent_id,
      name: agent["name"] || agent["email"] || agent_id,
      email: agent["email"],
      workspace: workspace,
      issue: issue,
      status: status,
      last_action: last_action,
      organization_id: agent["organization_id"],
      engine: config["engine"] || "pi"
    }
  end

  defp extract_workspace(config, agent_id) do
    paths = config["workspace_paths"] || []

    if paths != [] do
      List.first(paths)
    else
      # Fallback: buscar en agent_config_overrides local
      case overrides_for(agent_id) do
        %{workspace_paths: [path | _]} -> path
        _ -> nil
      end
    end
  end

  defp extract_issue(agent_id) do
    # Buscar la conversación más reciente de este agente para inferir el issue
    conv =
      Repo.one(
        from(c in Conversation,
          where: c.agent_id == ^agent_id and c.is_deleted == false,
          order_by: [desc: c.last_message_at],
          limit: 1
        )
      )

    case conv do
      %{app_context: ctx, id: conv_id} when is_binary(ctx) and ctx != "" ->
        {ctx, conv_id}

      %{title: title, id: conv_id} when is_binary(title) and title != "" and title != "Nueva conversación" ->
        {title, conv_id}

      _ ->
        {nil, nil}
    end
  end

  defp extract_last_action(agent_id) do
    conv =
      Repo.one(
        from(c in Conversation,
          where: c.agent_id == ^agent_id and c.is_deleted == false,
          order_by: [desc: c.last_message_at],
          limit: 1
        )
      )

    case conv do
      %{last_message_at: ts} -> ts
      _ -> nil
    end
  end

  defp overrides_for(agent_id) do
    alias Soma.AgentConfigOverride

    case Repo.get_by(AgentConfigOverride, agent_id: agent_id) do
      nil -> nil
      override -> override
    end
  end

  defp maybe_filter_by_org(agents, nil), do: agents

  defp maybe_filter_by_org(agents, org_id) do
    Enum.filter(agents, fn a -> a[:organization_id] == org_id end)
  end

  defp thalamus_client do
    Application.get_env(:soma, :thalamus_client, Soma.ThalamusClient.Real)
  end
end
