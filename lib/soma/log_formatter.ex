defmodule Soma.LogFormatter do
  @moduledoc "JSON log formatter for Loki/Promtail ingestion."

  def format(level, msg, ts, md) do
    Jason.encode!(%{
      timestamp: Calendar.strftime(ts, "%Y-%m-%dT%H:%M:%S.%fZ"),
      level: level,
      message: to_string(msg),
      agent_id: md[:agent_id],
      request_id: md[:request_id],
      org_id: md[:org_id]
    }) <> "\n"
  end
end
