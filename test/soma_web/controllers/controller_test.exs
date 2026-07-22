defmodule SomaWeb.ControllerTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias SomaWeb.Helpers

  # ── Helpers ──────────────────────────────────────────────────────────

  test "helpers.json/3 returns JSON response" do
    conn =
      :get
      |> conn("/test")
      |> Helpers.json(200, %{ok: true})

    assert conn.status == 200
    assert Jason.decode!(conn.resp_body)["ok"] == true
  end

  test "helpers.format_file_list/1 formats entries" do
    files = [{"readme.md", "file", 100, ".md"}, {"docs", "dir", 0}]
    result = Helpers.format_file_list(files)
    assert [%{name: "readme.md", type: "file"}, %{name: "docs", type: "dir"}] = result
  end

  test "helpers.get_token/1 extracts Bearer token" do
    conn =
      :get
      |> conn("/test")
      |> put_req_header("authorization", "Bearer abc123")

    assert Helpers.get_token(conn) == "abc123"
  end

  test "helpers.get_token/1 returns nil without header" do
    conn = conn(:get, "/test")
    assert Helpers.get_token(conn) == nil
  end
end
