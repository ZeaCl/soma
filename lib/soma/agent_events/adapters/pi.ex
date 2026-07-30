defmodule Soma.AgentEvents.Adapters.Pi do
  @moduledoc """
  Adapter pi → AgentEvent v1.0.

  Mapea los eventos internos del runtime pi (agent_start, agent_end, tool_*,
  thinking_*, delta, etc.) al formato agnóstico AgentEvent definido en #210.

  Este es el ÚNICO lugar donde se conoce el formato de pi. Si se agrega un
  nuevo runtime (opencode, claude-code), se crea otro adapter en este mismo
  namespace y el resto del ecosistema no cambia.
  """

  alias Soma.AgentEvents

  @spec to_agent_event(atom(), map(), map()) :: map()
  def to_agent_event(:agent_start, agent_info, _metadata) do
    AgentEvents.build_event(%{
      agent: %{
        "id" => agent_info[:agent_id],
        "runtime" => "pi",
        "version" => agent_info[:runtime_version] || "0.42.0"
      },
      workspace: agent_info[:workspace],
      issue: agent_info[:issue],
      event: %{
        "type" => "agent.status",
        "status" => "running",
        "last_action" => "Agent started",
        "progress" => %{"turns" => 0, "tokens" => 0}
      }
    })
  end

  def to_agent_event(:agent_end, agent_info, metadata) do
    result = metadata[:result] || "success"

    AgentEvents.build_event(%{
      agent: %{
        "id" => agent_info[:agent_id],
        "runtime" => "pi",
        "version" => agent_info[:runtime_version] || "0.42.0"
      },
      workspace: agent_info[:workspace],
      issue: agent_info[:issue],
      event: %{
        "type" => "agent.status",
        "status" => "idle",
        "result" => result,
        "last_action" => metadata[:last_action] || "Agent finished",
        "progress" => metadata[:progress] || %{"turns" => 0, "tokens" => 0}
      }
    })
  end

  def to_agent_event(:agent_error, agent_info, metadata) do
    AgentEvents.build_event(%{
      agent: %{
        "id" => agent_info[:agent_id],
        "runtime" => "pi",
        "version" => agent_info[:runtime_version] || "0.42.0"
      },
      workspace: agent_info[:workspace],
      issue: agent_info[:issue],
      event: %{
        "type" => "agent.error",
        "status" => "error",
        "result" => "error",
        "last_action" => metadata[:message] || "Unknown error",
        "progress" => metadata[:progress] || %{"turns" => 0, "tokens" => 0}
      }
    })
  end

  def to_agent_event(:agent_aborted, agent_info, metadata) do
    AgentEvents.build_event(%{
      agent: %{
        "id" => agent_info[:agent_id],
        "runtime" => "pi",
        "version" => agent_info[:runtime_version] || "0.42.0"
      },
      workspace: agent_info[:workspace],
      issue: agent_info[:issue],
      event: %{
        "type" => "agent.status",
        "status" => "idle",
        "result" => "aborted",
        "last_action" => "Agent aborted",
        "progress" => metadata[:progress] || %{"turns" => 0, "tokens" => 0}
      }
    })
  end

  def to_agent_event(:tool_start, agent_info, metadata) do
    AgentEvents.build_event(%{
      agent: %{
        "id" => agent_info[:agent_id],
        "runtime" => "pi",
        "version" => agent_info[:runtime_version] || "0.42.0"
      },
      workspace: agent_info[:workspace],
      issue: agent_info[:issue],
      event: %{
        "type" => "agent.tool",
        "status" => "running",
        "last_action" => "Calling #{metadata[:tool_name] || "unknown tool"}",
        "progress" => metadata[:progress] || %{}
      }
    })
  end

  def to_agent_event(:progress, agent_info, metadata) do
    AgentEvents.build_event(%{
      agent: %{
        "id" => agent_info[:agent_id],
        "runtime" => "pi",
        "version" => agent_info[:runtime_version] || "0.42.0"
      },
      workspace: agent_info[:workspace],
      issue: agent_info[:issue],
      event: %{
        "type" => "agent.progress",
        "status" => "running",
        "last_action" => metadata[:last_action] || "Processing...",
        "progress" => metadata[:progress] || %{"turns" => 0, "tokens" => 0}
      }
    })
  end

  # ── Conversión por lotes ──────────────────────────────────────

  @doc """
  Convierte una lista de eventos internos de pi a AgentEvents.
  Útil para batch processing desde el AgentRunner.
  """
  @spec batch_convert([{atom(), map(), map()}]) :: [map()]
  def batch_convert(events) do
    Enum.map(events, fn {type, agent_info, metadata} ->
      to_agent_event(type, agent_info, metadata)
    end)
  end
end
