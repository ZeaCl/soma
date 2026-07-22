defmodule Soma.AgentMetrics do
  @moduledoc "Custom agent metrics for PromEx."
  @namespace :soma

  use PromEx.Plugin

  @impl true
  def event_metrics(_opts) do
    [
      Event.build(
        :soma_agent_sessions_total,
        :telemetry_metrics.counter(
          name: [:soma, :agent, :sessions, :total],
          event_name: [:soma, :agent, :session, :start],
          description: "Total agent sessions started",
          tags: [:agent_id, :engine]
        )
      ),
      Event.build(
        :soma_agent_requests_total,
        :telemetry_metrics.counter(
          name: [:soma, :agent, :requests, :total],
          event_name: [:soma, :agent, :request],
          description: "Total prompts sent",
          tags: [:agent_id]
        )
      ),
      Event.build(
        :soma_agent_response_duration,
        :telemetry_metrics.distribution(
          name: [:soma, :agent, :response, :duration, :milliseconds],
          event_name: [:soma, :agent, :response],
          description: "Agent response latency",
          buckets: [100, 500, 1000, 5000, 10_000, 30_000, 60_000],
          tags: [:agent_id, :engine],
          unit: {:native, :millisecond}
        )
      ),
      Event.build(
        :soma_agent_errors_total,
        :telemetry_metrics.counter(
          name: [:soma, :agent, :errors, :total],
          event_name: [:soma, :agent, :error],
          description: "Total agent errors",
          tags: [:agent_id, :error_type]
        )
      ),
      Event.build(
        :soma_agent_tool_calls_total,
        :telemetry_metrics.counter(
          name: [:soma, :agent, :tool_calls, :total],
          event_name: [:soma, :agent, :tool],
          description: "Total tool calls",
          tags: [:agent_id, :tool_name]
        )
      ),
      Event.build(
        :soma_agent_thinking_duration,
        :telemetry_metrics.distribution(
          name: [:soma, :agent, :thinking, :duration, :milliseconds],
          event_name: [:soma, :agent, :thinking],
          description: "Agent thinking time",
          buckets: [50, 100, 500, 1000, 5000, 15_000],
          tags: [:agent_id],
          unit: {:native, :millisecond}
        )
      )
    ]
  end

  @impl true
  def polling_metrics(_opts), do: []

  @impl true
  def manual_metrics(_opts), do: []

  # ── Public helpers ──────────────────────────────────────────────────

  def session_started(agent_id, engine) do
    :telemetry.execute([:soma, :agent, :session, :start], %{}, %{agent_id: agent_id, engine: engine})
  end

  def request_sent(agent_id) do
    :telemetry.execute([:soma, :agent, :request], %{}, %{agent_id: agent_id})
  end

  def response_duration(agent_id, engine, duration_ms) do
    :telemetry.execute([:soma, :agent, :response], %{duration: duration_ms}, %{agent_id: agent_id, engine: engine})
  end

  def error_occurred(agent_id, error_type) do
    :telemetry.execute([:soma, :agent, :error], %{}, %{agent_id: agent_id, error_type: error_type})
  end

  def tool_called(agent_id, tool_name) do
    :telemetry.execute([:soma, :agent, :tool], %{}, %{agent_id: agent_id, tool_name: tool_name})
  end

  def thinking_duration(agent_id, duration_ms) do
    :telemetry.execute([:soma, :agent, :thinking], %{duration: duration_ms}, %{agent_id: agent_id})
  end
end

# ── Workspaces helper ──
def workspace_count(count) do
  :telemetry.execute([:soma, :workspace, :count], %{}, %{})
end

# ── Skill executed helper ──
def skill_executed(skill_name) do
  :telemetry.execute([:soma, :skill, :execute], %{}, %{skill_name: skill_name})
end

# ── Pi Sidecar status helper ──
def sidecar_status(up?) do
  :telemetry.execute([:soma, :sidecar, :status], %{}, %{status: if(up?, do: 1, else: 0)})
end
