defmodule Soma.FileSystem.Real do
  @moduledoc "Implementación real — File module de Elixir."
  @behaviour Soma.FileSystem

  @impl true
  def read(path), do: File.read(path)
  @impl true
  def read!(path), do: File.read!(path)
  @impl true
  def write(path, content), do: File.write(path, content)
  @impl true
  def mkdir_p(path), do: File.mkdir_p(path)
  @impl true
  def exists?(path), do: File.exists?(path)
  @impl true
  def dir?(path), do: File.dir?(path)
  @impl true
  def ls(path), do: File.ls(path)
  @impl true
  def rm(path), do: File.rm(path)
  @impl true
  def rmdir(path), do: File.rmdir(path)
  @impl true
  def rm_rf(path), do: File.rm_rf(path)
  @impl true
  def rename(old, new), do: File.rename(old, new)
  @impl true
  def stat(path), do: File.stat(path)
  @impl true
  def cp_r(src, dst), do: File.cp_r(src, dst)
end
