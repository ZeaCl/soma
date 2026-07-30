defmodule Soma.AgentDashboard do
  @moduledoc """
  Dashboard de agentes — consume AgentState (ETS alimentado por eventos Redis)
  con fallback a Thalamus + BD local.

  La respuesta sigue el contrato AgentEvent v1.0 definido en #210:
  campos runtime-agnostic (runtime, runtime_version, workspace, issue, status,
  last_action, progress, result) sin acoplarse a pi.
  """
  import Ecto.Query
  alias Soma.{AgentState, Repo, Conversation}

  @doc """
  Lista agentes con datos del dashboard en formato AgentEvent v1.0.

  Prioriza AgentState (tiempo real vía Redis). Si no hay datos,
  hace fallback a Thalamus + BD local y seedea AgentState.
  """
  def list_agents(token \\ nil, org_id \\ nil) do
    agents = AgentState.list_agents()

    if agents != [] do
      {:ok, maybe_filter_by_org(agents, org_id)}
    else
      fallback_from_thalamus(token, org_id)
    end
  end

  @doc "Obtiene un solo agente con datos del dashboard."
  def get_agent(agent_id) do
    case AgentState.get_agent(agent_id) do
      nil -> {:error, :not_found}
      state -> {:ok, state}
    end
  end

  # ── Fallback ────────────────────────────────────────────────

  defp fallback_from_thalamus(token, org_id) do
    case thalamus_client().get_user(token) do
      {:ok, agents} when is_list(agents) ->
        enriched = Enum.map(agents, &enrich_from_db/1)
        AgentState.seed_from_thalamus(agents)
        {:ok, maybe_filter_by_org(enriched, org_id)}

      {:ok, _} ->
        {:ok, []}

      error ->
        error
    end
  end

  defp enrich_from_db(agent) do
    agent_id = agent["id"]
    config = agent["agent_config"] || %{}

    workspace = extract_workspace(config, agent_id)
    {issue, _conv_id} = extract_issue(agent_id)
    last_action = extract_last_action(agent_id)

    %{
      id: agent_id,
      name: agent["name"] || agent["email"] || agent_id,
      email: agent["email"],
      organization_id: agent["organization_id"],
      runtime: config["engine"] || "pi",
      runtime_version: nil,
      workspace: workspace,
      issue: issue,
      status: agent["status"] || "idle",
      last_action: last_action,
      progress: %{"turns" => 0, "tokens" => 0},
      result: nil,
      event_type: "agent.status",
      spec_version: "1.0",
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp extract_workspace(config, agent_id) do
    paths = config["workspace_paths"] || []

    if paths != [] do
      List.first(paths)
    else
      case overrides_for(agent_id) do
        %{workspace_paths: [path | _]} -> path
        _ -> nil
      end
    end
  end

  defp extract_issue(agent_id) do
    conv =
      Repo.one(
        from(c in Conversation,
          where: c.agent_id == ^agent_id and c.is_deleted == false,
          order_by: [desc: c.last_message_at],
          limit: 1
        )
      )

    case conv do
      %{app_context: ctx} when is_binary(ctx) and ctx != "" ->
        issue = parse_issue_context(ctx)
        {issue, conv.id}

      %{title: title} when is_binary(title) and title != "" and title != "Nueva conversación" ->
        {%{repo: nil, number: nil, title: title}, conv.id}

      _ ->
        {nil, nil}
    end
  end

  defp parse_issue_context(ctx) do
    # Intenta parsear formato "owner/repo#number" o "owner/repo"
    case Regex.run(~r{([\w\-\.]+/[\w\-\.]+)#?(\d+)?}, ctx) do
      [_, repo, number] ->
        %{repo: repo, number: String.to_integer(number), title: ctx}

      [_, repo] ->
        %{repo: repo, number: nil, title: ctx}

      nil ->
        %{repo: nil, number: nil, title: ctx}
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
    Repo.get_by(AgentConfigOverride, agent_id: agent_id)
  end

  defp maybe_filter_by_org(agents, nil), do: agents

  defp maybe_filter_by_org(agents, org_id) do
    Enum.filter(agents, fn a ->
      a[:organization_id] == org_id or a["organization_id"] == org_id
    end)
  end

  defp thalamus_client do
    Application.get_env(:soma, :thalamus_client, Soma.ThalamusClient.Real)
  end
end
