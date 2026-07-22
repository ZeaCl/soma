defmodule SomaWeb.ControllerIntegrationTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias Soma.Repo
  alias Soma.Conversations
  alias SomaWeb.{ConversationController, SkillController, ApiKeyController, AgentController}

  @org_id "00000000-0000-0000-0000-000000000001"
  @user_id "user_test"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Application.put_env(:soma, :thalamus_client, Soma.ThalamusClient.Mock)
    Soma.ThalamusClient.Mock.start_link(%{})
    on_exit(fn -> Application.delete_env(:soma, :thalamus_client) end)
  end

  defp authed_conn(method, path) do
    conn(method, path)
    |> assign(:org_id, @org_id)
    |> assign(:user_id, @user_id)
    |> assign(:authenticated, true)
  end

  # ── ConversationController ───────────────────────────────────────────

  test "conversation CRUD flow" do
    list = authed_conn(:get, "/") |> ConversationController.call(ConversationController.init([]))
    assert list.status == 200

    conv = Conversations.get_or_create(@org_id, @user_id, "agent-ci", "chat")

    # Show conversation
    show = authed_conn(:get, "/#{conv.id}")
           |> Plug.Conn.put_private(:plug_route, %{path_params: %{"id" => conv.id}})
           |> ConversationController.call(ConversationController.init([]))
    assert show.status == 200
    body = Jason.decode!(show.resp_body)
    assert body["id"] == conv.id

    # Post message
    post =
      :post
      |> authed_conn("/#{conv.id}/messages")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"role" => "user", "content" => "Hello"})
      |> ConversationController.call(ConversationController.init([]))
    assert post.status == 201

    # Show with messages
    show2 = authed_conn(:get, "/#{conv.id}")
            |> Plug.Conn.put_private(:plug_route, %{path_params: %{"id" => conv.id}})
            |> ConversationController.call(ConversationController.init([]))
    assert show2.status == 200
    msgs = Jason.decode!(show2.resp_body)["messages"]
    assert length(msgs) >= 1

    # Delete
    del = authed_conn(:delete, "/#{conv.id}") |> ConversationController.call(ConversationController.init([]))
    assert del.status == 200
  end

  # ── SkillController ──────────────────────────────────────────────────

  test "skill CRUD flow" do
    list = authed_conn(:get, "/") |> SkillController.call(SkillController.init([]))
    assert list.status == 200

    create =
      :post
      |> authed_conn("/")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"name" => "test-skill-ci", "content" => "# Test"})
      |> SkillController.call(SkillController.init([]))
    assert create.status == 201

    # Show
    show = authed_conn(:get, "/test-skill-ci")
           |> Plug.Conn.put_private(:plug_route, %{path_params: %{"name" => "test-skill-ci"}})
           |> SkillController.call(SkillController.init([]))
    assert show.status == 200

    # Update
    update =
      :put
      |> authed_conn("/test-skill-ci")
      |> Plug.Conn.put_private(:plug_route, %{path_params: %{"name" => "test-skill-ci"}})
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"content" => "# Updated"})
      |> SkillController.call(SkillController.init([]))
    assert update.status == 200

    del = authed_conn(:delete, "/test-skill-ci")
          |> Plug.Conn.put_private(:plug_route, %{path_params: %{"name" => "test-skill-ci"}})
          |> SkillController.call(SkillController.init([]))
    assert del.status == 204

    # Assign to agents
    assign =
      :put
      |> authed_conn("/fund-management/agents")
      |> Plug.Conn.put_private(:plug_route, %{path_params: %{"name" => "fund-management"}})
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"agentIds" => []})
      |> SkillController.call(SkillController.init([]))
    assert assign.status == 200
  end

  test "GET /:name returns 404 for missing skill" do
    conn = authed_conn(:get, "/no-existe")
           |> Plug.Conn.put_private(:plug_route, %{path_params: %{"name" => "no-existe"}})
           |> SkillController.call(SkillController.init([]))
    assert conn.status == 404
  end

  test "DELETE /:name returns 404 for missing skill" do
    conn = authed_conn(:delete, "/no-existe")
           |> Plug.Conn.put_private(:plug_route, %{path_params: %{"name" => "no-existe"}})
           |> SkillController.call(SkillController.init([]))
    assert conn.status == 404
  end

  # ── ApiKeyController ─────────────────────────────────────────────────

  test "POST / creates API key" do
    conn =
      :post
      |> authed_conn("/")
      |> put_req_header("content-type", "application/json")
      |> Map.put(:body_params, %{"name" => "test-key-ci"})
      |> ApiKeyController.call(ApiKeyController.init([]))
    assert conn.status == 201
    assert String.starts_with?(Jason.decode!(conn.resp_body)["api_key"], "zs_live_")
  end

  # ── AgentController ──────────────────────────────────────────────────

  test "agent list returns 200" do
    conn = authed_conn(:get, "/") |> AgentController.call(AgentController.init([]))
    assert conn.status == 200
  end
end
