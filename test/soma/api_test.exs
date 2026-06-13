defmodule Soma.APITest do
  use ExUnit.Case, async: false

  @base "http://localhost:4084/api/v1"
  @key "zs_live_bootstrap_test_key_2026"

  setup do
    # Share DB sandbox with the server process
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Soma.Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Soma.Repo, {:shared, self()})
    :ok
  end

  test "health check" do
    {:ok, %{status: 200, body: body}} = Req.get("http://localhost:4084/health")
    assert body["status"] == "ok"
    assert body["service"] == "soma"
  end

  test "401 without auth" do
    {:ok, %{status: 401}} = Req.get("#{@base}/conversations")
  end

  test "conversations with api key returns empty list" do
    {:ok, %{status: 200, body: body}} = Req.get("#{@base}/conversations",
      headers: %{"x-api-key" => @key})
    assert body["data"] == []
    assert body["total"] == 0
  end

  test "create api key" do
    {:ok, %{status: 201, body: body}} = Req.post("#{@base}/api-keys",
      json: %{name: "test-key-#{:rand.uniform(999)}", scopes: ["soma:read"]},
      headers: %{"x-api-key" => @key})
    assert String.starts_with?(body["api_key"], "zs_live_")
  end

  test "files CRUD flow" do
    headers = %{"x-api-key" => @key}

    # Upload
    content = "test content #{:rand.uniform(9999)}"
    b64 = Base.encode64(content)
    {:ok, %{status: 200, body: upload}} = Req.post("#{@base}/files/upload",
      json: %{name: "test.txt", data: b64}, headers: headers)
    assert upload["ok"]
    assert upload["path"] == "test.txt"

    # List
    {:ok, %{status: 200, body: list}} = Req.get("#{@base}/files", headers: headers)
    names = Enum.map(list["files"], & &1["name"])
    assert "test.txt" in names

    # Read
    {:ok, %{status: 200, body: read}} = Req.get("#{@base}/files/content?path=test.txt", headers: headers)
    assert read == content

    # Mkdir
    {:ok, %{status: 200}} = Req.post("#{@base}/files/mkdir",
      json: %{path: "testdir"}, headers: headers)

    # Move
    {:ok, %{status: 200, body: moved}} = Req.post("#{@base}/files/move",
      json: %{source: "test.txt", dest: "testdir/test.txt"}, headers: headers)
    assert moved["path"] == "testdir/test.txt"

    # Delete
    {:ok, %{status: 200}} = Req.delete("#{@base}/files?path=testdir/test.txt", headers: headers)

    # History
    {:ok, %{status: 200, body: hist}} = Req.get("#{@base}/files/history?path=testdir/test.txt",
      headers: headers)
    assert is_list(hist["commits"])
  end

  test "skills crud" do
    headers = %{"x-api-key" => @key}
    name = "test-skill-#{:rand.uniform(9999)}"

    # Create
    {:ok, %{status: 201}} = Req.post("#{@base}/skills",
      json: %{name: name, content: "# Test\n\nhello"}, headers: headers)

    # List
    {:ok, %{status: 200, body: list}} = Req.get("#{@base}/skills", headers: headers)
    assert is_list(list["data"])
    assert length(list["data"]) > 0

    # Read
    {:ok, %{status: 200, body: read}} = Req.get("#{@base}/skills/#{name}", headers: headers)
    assert read["name"] == name
    assert read["source"] == "custom"

    # Delete
    {:ok, %{status: 204}} = Req.delete("#{@base}/skills/#{name}", headers: headers)
  end
end
