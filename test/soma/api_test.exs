defmodule Soma.APITest do
  use ExUnit.Case, async: false

  @base "http://soma.zea.localhost/api/v1"
  @health "http://soma.zea.localhost/health"
  @key "zs_live_bootstrap_test_key_2026"

  # No sandbox setup needed — tests hit Docker server via Caddy proxy

  # Helper: server returns text/plain, decode JSON manually
  defp decode(body) when is_binary(body), do: Jason.decode!(body)
  defp decode(body), do: body

  test "health check" do
    {:ok, %{status: 200, body: body}} = Req.get(@health)
    decoded = decode(body)
    assert decoded["status"] == "ok"
    assert decoded["service"] == "soma"
  end

  test "401 without auth" do
    {:ok, %{status: 401}} = Req.get("#{@base}/conversations")
  end

  test "conversations with api key returns empty list" do
    {:ok, %{status: 200, body: body}} = Req.get("#{@base}/conversations",
      headers: %{"x-api-key" => @key})
    decoded = decode(body)
    assert decoded["data"] == []
    assert decoded["total"] == 0
  end

  test "create api key" do
    {:ok, %{status: 201, body: body}} = Req.post("#{@base}/api-keys",
      json: %{name: "test-key-#{:rand.uniform(999)}", scopes: ["soma:read"]},
      headers: %{"x-api-key" => @key})
    decoded = decode(body)
    assert String.starts_with?(decoded["api_key"], "zs_live_")
  end

  test "files CRUD flow" do
    headers = %{"x-api-key" => @key}

    # Upload
    content = "test content #{:rand.uniform(9999)}"
    b64 = Base.encode64(content)
    {:ok, %{status: 200, body: body}} = Req.post("#{@base}/files/upload",
      json: %{name: "test.txt", data: b64}, headers: headers)
    upload = decode(body)
    assert upload["ok"]
    assert upload["path"] == "test.txt"

    # List
    {:ok, %{status: 200, body: body}} = Req.get("#{@base}/files", headers: headers)
    list = decode(body)
    names = Enum.map(list["files"], & &1["name"])
    assert "test.txt" in names

    # Read
    {:ok, %{status: 200, body: read}} = Req.get("#{@base}/files/content?path=test.txt", headers: headers)
    assert read == content

    # Mkdir
    {:ok, %{status: 200}} = Req.post("#{@base}/files/mkdir",
      json: %{path: "testdir"}, headers: headers)

    # Move
    {:ok, %{status: 200, body: body}} = Req.post("#{@base}/files/move",
      json: %{source: "test.txt", dest: "testdir/test.txt"}, headers: headers)
    moved = decode(body)
    assert moved["path"] == "testdir/test.txt"

    # Delete
    {:ok, %{status: 200}} = Req.delete("#{@base}/files?path=testdir/test.txt", headers: headers)

    # History
    {:ok, %{status: 200, body: body}} = Req.get("#{@base}/files/history?path=testdir/test.txt",
      headers: headers)
    hist = decode(body)
    assert is_list(hist["commits"])
  end

  test "skills crud" do
    headers = %{"x-api-key" => @key}
    name = "test-skill-#{:rand.uniform(9999)}"

    # Create
    {:ok, %{status: 201}} = Req.post("#{@base}/skills",
      json: %{name: name, content: "# Test\n\nhello"}, headers: headers)

    # List
    {:ok, %{status: 200, body: body}} = Req.get("#{@base}/skills", headers: headers)
    list = decode(body)
    assert is_list(list["data"])
    assert length(list["data"]) > 0

    # Read
    {:ok, %{status: 200, body: body}} = Req.get("#{@base}/skills/#{name}", headers: headers)
    read = decode(body)
    assert read["name"] == name
    assert read["source"] == "custom"

    # Delete
    {:ok, %{status: 204}} = Req.delete("#{@base}/skills/#{name}", headers: headers)
  end
end
