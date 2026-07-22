defmodule SomaWeb.ControllerIntegrationTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias Soma.Repo
  alias Soma.Conversations
  alias SomaWeb.{ConversationController, SkillController, ApiKeyController}

  @org_id "00000000-0000-0000-0000-000000000001"
  @user_id "user_test"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
  end

  defp authed_conn(method, path) do
    conn(method, path)
    |> assign(:org_id, @org_id)
    |> assign(:user_id, @user_id)
    |> assign(:authenticated, true)
  end

  # ── ConversationController ───────────────────────────────────────────

  test "GET / returns list" do
    conn =
      :get
      |> authed_conn("/")
      |> ConversationController.call(ConversationController.init([]))

    assert conn.status == 200
    body = Jason.decode!(conn.resp_body)
    assert body["data"] == []
  end

  test "GET /:id returns 404 for missing" do
    conn =
      :get
      |> authed_conn("/non-existent-id")
      |> ConversationController.call(ConversationController.init([]))

    assert conn.status == 404
  end

  test "POST /:id/messages creates message" do
    conv = Conversations.get_or_create(@org_id, @user_id, "agent-1", "chat")

    conn =
      :post
      |> authed_conn("/#{conv.id}/messages")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"role" => "user", "content" => "Hello"})
      |> ConversationController.call(ConversationController.init([]))

    assert conn.status == 201
  end

  test "DELETE /:id soft-deletes" do
    conv = Conversations.get_or_create(@org_id, @user_id, "agent-3", "chat")

    conn =
      :delete
      |> authed_conn("/#{conv.id}")
      |> ConversationController.call(ConversationController.init([]))

    assert conn.status == 200
  end

  # ── SkillController ──────────────────────────────────────────────────

  test "GET / returns skills list" do
    conn =
      :get
      |> authed_conn("/")
      |> SkillController.call(SkillController.init([]))

    assert conn.status == 200
    assert is_list(Jason.decode!(conn.resp_body)["data"])
  end

  test "GET /:name returns 404 for missing" do
    conn =
      :get
      |> authed_conn("/missing-skill")
      |> SkillController.call(SkillController.init([]))

    assert conn.status == 404
  end

  test "POST / creates skill and DELETE /:name removes it" do
    create_conn =
      :post
      |> authed_conn("/")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"name" => "test-skill-int", "content" => "# Test"})
      |> SkillController.call(SkillController.init([]))

    assert create_conn.status == 201

    delete_conn =
      :delete
      |> authed_conn("/test-skill-int")
      |> SkillController.call(SkillController.init([]))

    assert delete_conn.status == 204
  end

  # ── ApiKeyController ─────────────────────────────────────────────────

  test "POST / creates API key" do
    conn =
      :post
      |> authed_conn("/")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"name" => "test-key"})
      |>  ApiKeyController.call(ApiKeyController.init([]))

    assert conn.status == 201
    key = Jason.decode!(conn.resp_body)["api_key"]
    assert String.starts_with?(key, "zs_live_")
  end
end
