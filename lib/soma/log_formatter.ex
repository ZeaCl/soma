defmodule Soma.LogFormatter do
  @moduledoc "JSON log formatter for Loki/Promtail ingestion."

  # Phoenix endpoint logs messages as {:string, iodata} tuples.
  # Convert to string before JSON encoding, otherwise to_string/1 crashes.
  def format(level, {:string, iodata}, ts, md) do
    format(level, IO.iodata_to_binary(iodata), ts, md)
  end

  # Handle report callbacks (e.g., GenServer crashes)
  def format(level, {format_str, format_args}, ts, md) when is_list(format_args) do
    msg =
      try do
        :io_lib.format(format_str, format_args) |> IO.iodata_to_binary()
      rescue
        _ -> inspect({format_str, format_args})
      end

    format(level, msg, ts, md)
  end

  def format(level, msg, ts, md) do
    ts_formatted =
      cond do
        is_struct(ts, DateTime) ->
          Calendar.strftime(ts, "%Y-%m-%dT%H:%M:%S.%fZ")

        is_integer(ts) ->
          # Elixir 1.18+: Logger.Formatter passes system_time in microseconds
          ts
          |> DateTime.from_unix!(:microsecond)
          |> Calendar.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

        true ->
          to_string(ts)
      end

    Jason.encode!(%{
      timestamp: ts_formatted,
      level: level,
      message: to_string(msg),
      agent_id: md[:agent_id],
      request_id: md[:request_id],
      org_id: md[:org_id]
    }) <> "\n"
  end
end
