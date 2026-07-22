defmodule Soma.FileSystem.Mock do
  @moduledoc "Mock para FileSystem — responde con datos predefinidos."
  @behaviour Soma.FileSystem

  def start_link(responses \\ %{}) do
    Agent.start_link(fn -> responses end, name: __MODULE__)
  end

  def set_responses(responses) do
    Agent.update(__MODULE__, fn _ -> responses end)
  end

  defp get(key, default) do
    Agent.get(__MODULE__, fn r -> Map.get(r, key, default) end)
  end

  @impl true
  def read(path), do: get({:read, path}, {:ok, ""})
  @impl true
  def read!(path), do: get({:read!, path}, "")
  @impl true
  def write(_path, _content), do: :ok
  @impl true
  def mkdir_p(_path), do: :ok
  @impl true
  def exists?(_path), do: get(:exists_default, true)
  @impl true
  def dir?(_path), do: get(:dir_default, true)
  @impl true
  def ls(_path), do: {:ok, []}
  @impl true
  def rm(_path), do: :ok
  @impl true
  def rmdir(_path), do: :ok
  @impl true
  def rm_rf(_path), do: {:ok, []}
  @impl true
  def rename(_old, _new), do: :ok
  @impl true
  def rename!(_old, _new), do: :ok
  @impl true
  def rm!(_path), do: :ok
  @impl true
  def chmod!(_path, _mode), do: :ok
  @impl true
  def stat(_path), do: %{size: 0}
  @impl true
  def cp_r(_src, _dst), do: {:ok, []}
end
