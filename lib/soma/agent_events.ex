defmodule Soma.AgentEvents do
  @moduledoc """
  Contrato de eventos de agente — agnóstico del runtime.

  Define el formato AgentEvent v1.0 usado por todo el ecosistema ZEA
  (dashboard, notificaciones, orquestador). Cualquier runtime (pi, opencode,
  claude-code, custom) emite eventos en este mismo formato.

  ## Formato AgentEvent v1.0

  ```json
  {
    "spec_version": "1.0",
    "agent": { "id": "...", "runtime": "pi", "version": "0.42.0" },
    "workspace": "preview/zea/issue-167",
    "issue": { "repo": "ZeaCl/zea", "number": 167 },
    "event": {
      "type": "agent.status",
      "status": "running",
      "progress": { "turns": 12, "tokens": 45000 },
      "last_action": "Implementando...",
      "result": "success"
    },
    "timestamp": "2026-07-30T15:00:00Z"
  }
  ```
  """

  require Logger

  @spec_version "1.0"

  @doc """
  Publica un evento en el canal Redis `agents:events`.

  Todos los consumidores (dashboard, notificaciones, orquestador)
  se suscriben a este canal y reciben el mismo formato.
  """
  @spec publish(map()) :: :ok
  def publish(event) do
    # Spawn async to avoid blocking the AgentRunner on Redis latency
    Task.start(fn ->
      with :ok <- validate_event(event),
           {:ok, payload} <- Jason.encode(event) do
        case start_redix() do
          {:ok, conn} ->
            Redix.command(conn, ["PUBLISH", "agents:events", payload])
            Redix.stop(conn)

          {:error, reason} ->
            Logger.warning("AgentEvents: Redis no disponible (#{inspect(reason)})")
        end
      end
    end)

    :ok
  end

  @doc """
  Construye un AgentEvent a partir de un evento interno de pi.
  Desacopla el runtime — el adapter sabe mapear sus tipos nativos.
  """
  @spec from_pi_event(atom(), map(), map()) :: map()
  def from_pi_event(event_type, agent_info, metadata \\ %{}) do
    Soma.AgentEvents.Adapters.Pi.to_agent_event(event_type, agent_info, metadata)
  end

  @doc """
  Construye un AgentEvent genérico para cualquier runtime.
  Útil para eventos que no vienen de un adapter específico.
  """
  @spec build_event(map()) :: map()
  def build_event(fields) do
    now = DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

    %{
      "spec_version" => @spec_version,
      "agent" => fields[:agent] || %{},
      "workspace" => fields[:workspace],
      "issue" => fields[:issue] || nil,
      "event" => fields[:event] || %{},
      "timestamp" => fields[:timestamp] || now
    }
  end

  # ── Validación ──────────────────────────────────────────────

  defp validate_event(event) do
    cond do
      not is_map(event) -> {:error, :not_a_map}
      Map.get(event, "spec_version") != @spec_version -> {:error, :invalid_spec_version}
      not is_map(event["agent"]) -> {:error, :missing_agent}
      is_nil(event["agent"]["id"]) -> {:error, :missing_agent_id}
      true -> :ok
    end
  end

  # ── Redis connection (transient, for publishing) ────────────

  defp start_redix do
    redis_config = Application.get_env(:soma, :redis, [])

    opts =
      redis_config
      |> Enum.into([])
      |> Keyword.put(:sync_connect, true)
      |> Keyword.put(:socket_opts, [connect_timeout: 2000])

    Redix.start_link(opts)
  end
end
