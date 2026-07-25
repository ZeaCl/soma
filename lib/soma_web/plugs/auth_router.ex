defmodule SomaWeb.Plugs.AuthRouter do
  @moduledoc "Auth router — encadena JWTAuth → ApiKeyAuth → Guard → API controllers."
  use Plug.Router

  plug(SomaWeb.Plugs.JWTAuth)
  plug(SomaWeb.Plugs.ApiKeyAuth)
  plug(SomaWeb.Plugs.Guard)
  plug(:match)
  plug(:dispatch)

  # ── Conversations ──
  forward("/conversations", to: SomaWeb.ConversationController)
  forward("/conversations/:id", to: SomaWeb.ConversationController)

  # ── API Keys ──
  forward("/api-keys", to: SomaWeb.ApiKeyController)

  # ── Files (unified) — DEBE ir ANTES de /files genérico ──
  forward("/files/unified", to: SomaWeb.SandboxController)
  forward("/files/unified/upload", to: SomaWeb.SandboxController)

  # ── Files ──
  forward("/files", to: SomaWeb.FileController)

  # ── Skills ──
  forward("/skills", to: SomaWeb.SkillController)
  forward("/skills/:name", to: SomaWeb.SkillController)

  # ── Agents ──
  forward("/agents", to: SomaWeb.AgentController)
  forward("/agents/:id", to: SomaWeb.AgentController)
  forward("/agents/:id/skills", to: SomaWeb.AgentController)
  forward("/agents/:id/config", to: SomaWeb.AgentController)
  forward("/agents/:id/share", to: SomaWeb.AgentController)
  forward("/agents/:id/share/:user_id", to: SomaWeb.AgentController)
  forward("/agents/:id/shares", to: SomaWeb.AgentController)
  forward("/agent-shares", to: SomaWeb.AgentController)
  forward("/agents/shared", to: SomaWeb.AgentController)

  # ── Sandboxes ──
  forward("/sandboxes", to: SomaWeb.SandboxController)
  forward("/sandboxes/create", to: SomaWeb.SandboxController)
  forward("/sandboxes/:id", to: SomaWeb.SandboxController)

  # ── Upload (legacy) ──
  forward("/upload", to: SomaWeb.SandboxController)

  match _ do
    Plug.Conn.send_resp(conn, 404, Jason.encode!(%{error: "not_found"}))
  end
end
