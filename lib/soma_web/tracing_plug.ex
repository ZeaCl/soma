defmodule SomaWeb.TracingPlug do
  @moduledoc "OpenTelemetry tracing plug — emite spans HTTP para Plug.Router."
  @behaviour Plug

  require OpenTelemetry.Tracer, as: Tracer

  @impl true
  def init(opts), do: opts

  @impl true
  def call(conn, _opts) do
    Tracer.with_span conn.request_path, %{kind: :server} do
      Tracer.set_attributes(%{
        "http.method": conn.method,
        "http.url": conn.request_path
      })

      conn
    end
  end
end
