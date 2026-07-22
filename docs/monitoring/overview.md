# Monitoring

Soma exports metrics, traces, and structured logs to the ZEA monitoring stack.

## Metrics (Prometheus)

Endpoint: `GET /metrics` (Prometheus text format)

### BEAM & Ecto (via PromEx)

| Plugin | Metrics |
|---|---|
| `PromEx.Plugins.BEAM` | Memory, processes, GC, scheduler |
| `PromEx.Plugins.Ecto` | Query rate, latency, pool size |
| `PromEx.Plugins.Application` | Application uptime, dependencies |

### Agent Metrics (custom)

| Metric | Type | Labels |
|---|---|---|
| `soma_agent_sessions_total` | Counter | agent_id, engine |
| `soma_agent_requests_total` | Counter | agent_id |
| `soma_agent_response_duration_milliseconds` | Histogram | agent_id, engine |
| `soma_agent_errors_total` | Counter | agent_id, error_type |
| `soma_agent_tool_calls_total` | Counter | agent_id, tool_name |
| `soma_agent_thinking_duration_milliseconds` | Histogram | agent_id |
| `soma_workspaces_total` | LastValue | — |
| `soma_skills_executed_total` | Counter | skill_name |
| `soma_sidecar_pi_status` | LastValue | — |

## Alerts

Defined in `monitoring/alerts/rules.yml`:

| Alert | Condition | Severity |
|---|---|---|
| `SomaServiceDown` | `up{job="soma"} == 0` for 1m | critical |
| `SomaHighErrorRate` | Error rate >10% for 5m | warning |
| `SomaAgentResponseLatencyHigh` | p95 >30s for 5m | warning |
| `SomaNoActiveAgents` | No sessions for 10m | warning |

## Tracing (OpenTelemetry)

Spans are exported to Tempo via OTLP:

| Span | Attributes |
|---|---|
| `HTTP {method} {path}` | http.method, http.url (via TracingPlug) |
| `Ecto {repo} {query}` | db.type, db.statement (via opentelemetry_ecto) |

## Logs (Loki)

Logs are emitted as JSON to stdout and captured by Promtail:

```json
{"timestamp":"2026-01-01T00:00:00.000Z","level":"info","message":"...","agent_id":"...","request_id":"...","org_id":"..."}
```

## Dashboards

| Dashboard | Panels |
|---|---|
| **AI Services** | Agents, skills, workspaces, Pi Sidecar |
| **Services Health** | Uptime, latency, BEAM memory, Ecto queries |

## Setup

```bash
# Prometheus scrape config
- job_name: "soma"
  static_configs:
    - targets: ["soma:4084"]
```

See [ZeaCl/monitoring](https://github.com/ZeaCl/monitoring) for the full stack.
