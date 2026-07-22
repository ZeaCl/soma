defmodule SomaWeb.Helpers do
  @moduledoc "Helpers compartidos entre controllers."

  def json(conn, status, body) do
    conn
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.send_resp(status, Jason.encode!(body))
  end

  def format_file_list(files) do
    Enum.map(files, fn
      {name, "dir", size} -> %{name: name, type: "dir", size: size}
      {name, "file", size, ext} -> %{name: name, type: "file", size: size, ext: ext}
      other -> %{name: elem(other, 0), type: "unknown"}
    end)
  end

  def get_token(conn) do
    case Plug.Conn.get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      _ -> nil
    end
  end
end
