defmodule SomaWeb.Router do
  use Plug.Router

  plug(:match)
  plug(:dispatch)

  get "/health" do
    send_resp(conn, 200, Jason.encode!(%{status: "ok", service: "soma"}))
  end

  get "/metrics" do
    conn
    |> put_resp_content_type("text/plain")
    |> send_resp(200, PromEx.export())
  end

  get "/agent-ws" do
    conn
    |> WebSockAdapter.upgrade(SomaWeb.AgentSocket, %{}, timeout: 60_000)
    |> halt()
  end

  forward("/api", to: SomaWeb.Plugs.AuthRouter)

  # Backward compat: legacy paths from Sudlich migration
  forward("/api/conversations", to: SomaWeb.Plugs.AuthRouter)
  forward("/api/conversations/:id", to: SomaWeb.Plugs.AuthRouter)
  forward("/api/skills", to: SomaWeb.Plugs.AuthRouter)
  forward("/api/skills/:name", to: SomaWeb.Plugs.AuthRouter)
  forward("/api/files", to: SomaWeb.Plugs.AuthRouter)
  forward("/api/api-keys", to: SomaWeb.Plugs.AuthRouter)
  forward("/api/agents", to: SomaWeb.Plugs.AuthRouter)
  forward("/api/upload", to: SomaWeb.Plugs.AuthRouter)

  # Serve SPA index.html for root and any non-API path
  get "/" do
    serve_index(conn)
  end

  match _ do
    serve_index(conn)
  end

  defp serve_index(conn) do
    index_path = Path.join(:code.priv_dir(:soma), "static/index.html")

    case File.read(index_path) do
      {:ok, html} ->
        conn |> put_resp_content_type("text/html") |> send_resp(200, html)

      {:error, _} ->
        send_resp(conn, 404, "Not found")
    end
  end
end
