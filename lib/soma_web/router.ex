defmodule SomaWeb.Router do
  use Plug.Router

  plug :match
  plug :dispatch

  get "/health" do
    send_resp(conn, 200, Jason.encode!(%{status: "ok", service: "soma"}))
  end

  forward "/api", to: SomaWeb.Plugs.AuthRouter

  # Backward compat: legacy paths from Sudlich migration
  forward "/api/conversations", to: SomaWeb.Plugs.AuthRouter
  forward "/api/conversations/:id", to: SomaWeb.Plugs.AuthRouter
  forward "/api/skills", to: SomaWeb.Plugs.AuthRouter
  forward "/api/skills/:name", to: SomaWeb.Plugs.AuthRouter
  forward "/api/files", to: SomaWeb.Plugs.AuthRouter
  forward "/api/api-keys", to: SomaWeb.Plugs.AuthRouter
  forward "/api/agents", to: SomaWeb.Plugs.AuthRouter
  forward "/api/upload", to: SomaWeb.Plugs.AuthRouter
end
