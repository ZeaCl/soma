defmodule SomaWeb.ErrorJSON do
  def render("404.json", _), do: %{error: "not_found"}
  def render("500.json", _), do: %{error: "internal_server_error"}
end
