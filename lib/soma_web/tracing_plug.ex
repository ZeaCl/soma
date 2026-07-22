defmodule SomaWeb.TracingPlug do
  @moduledoc "OpenTelemetry tracing plug — emite spans HTTP para Plug.Router."
  @behaviour Plug

  @impl true
  def init(opts), do: opts

  @impl true
  def call(conn, _opts) do
    OpenTelemetry.Tracer.with_span conn.request_path, %{kind: :server} do
      OpenTelemetry.Tracer.set_attributes(%{
        "http.method": conn.method,
        "http.url": conn.request_path
      })
      conn
    end
  end
end
