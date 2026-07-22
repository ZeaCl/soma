defmodule SomaWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :soma

  plug(Corsica,
    origins: "*",
    allow_headers: ["authorization", "content-type", "x-api-key", "x-zea-org-id"],
    allow_methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  )

  plug(Plug.RequestId)
  plug(Plug.Telemetry, event_prefix: [:phoenix, :endpoint])
  plug(Plug.Parsers, parsers: [:json], json_decoder: Jason)

  plug(Plug.Static,
    at: "/",
    from: :soma,
    gzip: false,
    only: ~w(index.html assets favicon.ico zea-design.css icono-zea.svg text-zea.svg)
  )

  plug(SomaWeb.Router)
end
