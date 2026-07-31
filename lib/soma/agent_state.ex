defmodule Soma.AgentState do
  @moduledoc """
  Estado de agentes en tiempo real — alimentado por eventos Redis pub/sub.

  Mantiene una tabla ETS (`:agent_state`) con el último estado conocido
  de cada agente. Cualquier runtime publica eventos vía AgentEvents y
  AgentState los consolida aquí. El dashboard consulta esta tabla.

  Desacoplado de pi, opencode, o cualquier runtime específico.
  """
  use GenServer
  require Logger

  @table :agent_state
  @channel "agents:events"

  # ── Client API ──────────────────────────────────────────────

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Lista todos los agentes con su estado actual."
  @spec list_agents(keyword()) :: [map()]
  def list_agents(filters \\ []) do
    agents =
      @table
      |> :ets.tab2list()
      |> Enum.map(fn {_id, state} -> state end)
      |> Enum.sort_by(&(&1[:timestamp] || &1[:id]), :desc)

    if filters[:org_id] do
      Enum.filter(agents, fn a -> a[:organization_id] == filters[:org_id] end)
    else
      agents
    end
  end

  @doc "Obtiene el estado de un agente específico."
  @spec get_agent(String.t()) :: map() | nil
  def get_agent(agent_id) do
    case :ets.lookup(@table, agent_id) do
      [{^agent_id, state}] -> state
      [] -> nil
    end
  end

  @doc """
  Actualiza el estado de un agente directamente (sin pasar por Redis).
  Útil para inicializar desde Thalamus o para el fallback cuando Redis no está.
  """
  @spec upsert(String.t(), map()) :: :ok
  def upsert(agent_id, state) do
    GenServer.cast(__MODULE__, {:upsert, agent_id, state})
  end

  @doc "Inicializa agentes desde Thalamus (fallback cuando no hay eventos Redis)."
  @spec seed_from_thalamus([map()]) :: :ok
  def seed_from_thalamus(agents) when is_list(agents) do
    Enum.each(agents, fn agent ->
      agent_id = agent["id"]
      config = agent["agent_config"] || %{}

      state = %{
        id: agent_id,
        name: agent["name"] || agent["email"] || agent_id,
        email: agent["email"],
        organization_id: agent["organization_id"],
        runtime: config["engine"] || "pi",
        runtime_version: nil,
        workspace: List.first(config["workspace_paths"] || []),
        issue: nil,
        status: "idle",
        last_action: nil,
        progress: %{"turns" => 0, "tokens" => 0},
        result: nil,
        event_type: "agent.status",
        spec_version: "1.0",
        timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
      }

      :ets.insert(@table, {agent_id, state})
    end)

    Logger.info("AgentState: seeded #{length(agents)} agents from Thalamus")
    :ok
  end

  # ── GenServer Callbacks ─────────────────────────────────────

  @impl true
  def init(_opts) do
    @table =
      :ets.new(@table, [
        :set,
        :public,
        :named_table,
        read_concurrency: true,
        write_concurrency: true
      ])

    # Intentar suscribirse a Redis
    if redis_configured?() do
      {:ok, redix} = Redix.PubSub.start_link(redis_opts())
      Redix.PubSub.subscribe(redix, @channel, self())
      Logger.info("AgentState: subscribed to Redis channel #{@channel}")
      {:ok, %{redix: redix}}
    else
      Logger.info("AgentState: Redis not configured, running in local-only mode")
      {:ok, %{redix: nil}}
    end
  end

  @impl true
  def handle_cast({:upsert, agent_id, state}, s) do
    now = DateTime.utc_now() |> DateTime.to_iso8601()
    existing = get_agent(agent_id)
    merged = Map.merge(existing || %{}, Map.put(state, :timestamp, now))
    :ets.insert(@table, {agent_id, merged})
    {:noreply, s}
  end

  @impl true
  def handle_info({:redix_pubsub, _redix_pid, _ref, :subscribed, %{channel: @channel}}, s) do
    Logger.debug("AgentState: confirmed subscription to #{@channel}")
    {:noreply, s}
  end

  @impl true
  def handle_info({:redix_pubsub, _redix_pid, _ref, :message, %{channel: @channel, payload: payload}}, s) do
    case Jason.decode(payload) do
      {:ok, event} ->
        handle_agent_event(event)
        {:noreply, s}

      {:error, _} ->
        Logger.warning("AgentState: invalid JSON payload on #{@channel}")
        {:noreply, s}
    end
  end

  @impl true
  def handle_info({:redix_pubsub, _redix_pid, _ref, :disconnected, _}, s) do
    Logger.warning("AgentState: Redis disconnected, will retry")
    {:noreply, s}
  end

  @impl true
  def handle_info({:redix_pubsub, _redix_pid, _ref, :reconnected, _}, s) do
    Logger.info("AgentState: Redis reconnected")
    {:noreply, s}
  end

  @impl true
  def handle_info(_msg, s), do: {:noreply, s}

  # ── Event Processing ────────────────────────────────────────

  defp handle_agent_event(event) do
    agent = event["agent"] || %{}
    agent_id = agent["id"]
    event_data = event["event"] || %{}

    state = %{
      id: agent_id,
      name: agent["name"],
      email: agent["email"],
      organization_id: agent["organization_id"],
      runtime: agent["runtime"] || "unknown",
      runtime_version: agent["version"],
      workspace: event["workspace"],
      issue: event["issue"],
      status: event_data["status"] || "idle",
      last_action: event_data["last_action"],
      progress: event_data["progress"] || %{"turns" => 0, "tokens" => 0},
      result: event_data["result"],
      event_type: event_data["type"] || "agent.status",
      spec_version: event["spec_version"] || "1.0",
      timestamp: event["timestamp"] || DateTime.utc_now() |> DateTime.to_iso8601()
    }

    # Usa upsert en vez de insert directo para preservar campos que los
    # eventos no incluyen (organization_id, name, email). Sin esto, un
    # evento del agente pisa el registro completo y organization_id se
    # pierde → el filtro por org descarta al agente del dashboard.
    upsert(agent_id, state)
  end

  # ── Helpers ─────────────────────────────────────────────────

  defp redis_configured? do
    config = Application.get_env(:soma, :redis, [])
    Keyword.has_key?(config, :host)
  end

  defp redis_opts do
    config = Application.get_env(:soma, :redis, [])
    host = Keyword.get(config, :host, "redis")
    port = Keyword.get(config, :port, 6379)
    password = Keyword.get(config, :password)
    db = Keyword.get(config, :database, 0)

    opts = [host: host, port: port, database: db]
    opts = if password, do: Keyword.put(opts, :password, password), else: opts
    opts
  end
end
