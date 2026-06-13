defmodule SomaWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :soma

  plug Corsica, origins: "*", allow_headers: ["authorization", "content-type", "x-api-key", "x-zea-org-id"]
  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug SomaWeb.Router
end
