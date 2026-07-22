defmodule SomaWeb.Plugs.AuthRouter do
  use Plug.Router

  plug(SomaWeb.Plugs.JWTAuth)
  plug(SomaWeb.Plugs.ApiKeyAuth)
  plug(SomaWeb.Plugs.Guard)
  plug(:match)
  plug(:dispatch)

  forward("/v1", to: SomaWeb.ApiController)

  # Fallback: paths without /v1 prefix (backward compat)
  forward("/", to: SomaWeb.ApiController)
end
