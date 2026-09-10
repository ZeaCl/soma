defmodule SomaWeb.CliSkillControllerTest do
  use ExUnit.Case, async: false
  use Plug.Test

  alias Soma.{Repo, CliSkill}
  alias SomaWeb.CliSkillController

  @org "00000000-0000-0000-0000-000000000001"

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Repo, {:shared, self()})

    Application.put_env(:soma, :file_system, Soma.FileSystem.Mock)
    Soma.FileSystem.Mock.start_link(%{})
    Application.put_env(:soma, :secret_provider, Soma.SecretProvider.Mock)

    on_exit(fn ->
      Application.delete_env(:soma, :file_system)
      Application.delete_env(:soma, :secret_provider)
    end)

    :ok
  end

  defp call(conn, opts \\ []) do
    conn
    |> Plug.Conn.assign(:org_id, @org)
    |> then(fn c -> Enum.reduce(opts, c, fn {k, v}, acc -> Plug.Conn.assign(acc, k, v) end) end)
    |> CliSkillController.call(CliSkillController.init([]))
  end

  defp create_skill(attrs \\ %{}) do
    base = %{
      organization_id: @org,
      name: "aws-cli",
      cli_binary: "aws",
      install_method: "script",
      install_spec: %{"commands" => ["echo hi"]},
      skill_content: "# AWS"
    }

    %CliSkill{} |> CliSkill.changeset(Map.merge(base, attrs)) |> Repo.insert!()
  end

  test "GET / lists skills for the org" do
    create_skill()
    conn = call(conn(:get, "/"))
    assert conn.status == 200

    body = Jason.decode!(conn.resp_body)
    assert length(body["data"]) == 1
    assert hd(body["data"])["name"] == "aws-cli"
  end

  test "POST / creates a skill" do
    conn =
      conn(:post, "/")
      |> Map.put(:body_params, %{
        "name" => "gcloud",
        "cli_binary" => "gcloud",
        "install_method" => "script",
        "install_spec" => %{"commands" => ["echo hi"]},
        "skill_content" => "# gcloud"
      })
      |> call()

    assert conn.status == 201
    assert Jason.decode!(conn.resp_body)["data"]["name"] == "gcloud"
  end

  test "POST / with invalid attrs returns 422" do
    conn =
      conn(:post, "/")
      |> Map.put(:body_params, %{"name" => "broken"})
      |> call()

    assert conn.status == 422
  end

  test "GET /:name returns a skill" do
    create_skill()
    conn = call(conn(:get, "/aws-cli"))
    assert conn.status == 200
    assert Jason.decode!(conn.resp_body)["data"]["cli_binary"] == "aws"
  end

  test "GET /:name returns 404 for unknown" do
    conn = call(conn(:get, "/nope"))
    assert conn.status == 404
  end

  test "PUT /:name updates a skill" do
    create_skill()

    conn =
      conn(:put, "/aws-cli")
      |> Map.put(:body_params, %{"version" => "2.0"})
      |> call()

    assert conn.status == 200
    assert Jason.decode!(conn.resp_body)["data"]["version"] == "2.0"
  end

  test "DELETE /:name soft-deletes a skill" do
    create_skill()
    conn = call(conn(:delete, "/aws-cli"))
    assert conn.status == 200
    assert Jason.decode!(conn.resp_body)["ok"] == true
  end

  test "unknown route returns 404" do
    conn = call(conn(:get, "/aws-cli/nope/extra"))
    assert conn.status == 404
  end
end
