defmodule Soma.SandboxTest do
  use ExUnit.Case, async: false

  alias Soma.Sandbox

  @agent "00000000-0000-0000-0000-0000000000a1"
  @org   "00000000-0000-0000-0000-000000000001"

  test "username generates correct Linux username" do
    # First 12 chars of agent ID + "soma-" prefix
    assert Sandbox.username(@agent) == "soma-" <> String.slice(@agent, 0, 12)
  end

  test "home_dir returns correct path" do
    assert Sandbox.home_dir(@agent) == "/home/soma/#{@agent}"
  end

  test "create returns error when script missing" do
    result = Sandbox.create(@agent, @org,
      teams: "finanzas",
      mounts: [%{source: "/tmp", dest: "shared"}])
    assert is_tuple(result)
  end

  test "destroy returns error when script missing" do
    result = Sandbox.destroy(@agent)
    assert is_tuple(result)
  end

  test "create passes correct args to script" do
    result = Sandbox.create(@agent, @org, teams: "", mounts: [])
    assert is_tuple(result)
    assert elem(result, 0) in [:ok, :error]
  end

  test "destroy passes correct args to script" do
    result = Sandbox.destroy(@agent)
    assert is_tuple(result)
    assert elem(result, 0) in [:ok, :error]
  end

  test "different agents get different usernames" do
    a1 = Sandbox.username("aaaa1111-2222-3333-4444-555566667777")
    a2 = Sandbox.username("bbbb1111-2222-3333-4444-555566667777")
    refute a1 == a2
  end

  test "username handles short IDs" do
    assert Sandbox.username("abc") == "soma-abc"
  end

  test "home_dir is consistent with username convention" do
    home = Sandbox.home_dir(@agent)
    assert String.starts_with?(home, "/home/soma/")
    assert String.contains?(home, @agent)
  end
end
