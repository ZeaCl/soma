defmodule Soma.AIProvider do
  @moduledoc """
  Type-safe mapper for AI providers.

  Single source of truth for provider names, normalizing between
  external representations (strings from CLI/Thalamus) and internal
  representations (atoms verified by Dialyzer).

  ## Usage

  When receiving a provider string from an external source (CLI, API, Thalamus),
  always normalize through `from_string/1` first:

      {:ok, provider} = AIProvider.from_string("DeepSeek")
      AIProvider.to_query_param(provider)  # => "deepseek"
      AIProvider.to_env_var(provider)      # => "DEEPSEEK_API_KEY"

  For internal iteration over all supported providers, use `supported/0`:

      Enum.each(AIProvider.supported(), fn provider ->
        # provider is :deepseek | :openai | :anthropic
      end)
  """

  @type t :: :deepseek | :openai | :anthropic

  @supported [:deepseek, :openai, :anthropic]

  @doc """
  Converts any reasonable string representation to an atom.
  Case-insensitive and trims whitespace.
  Returns `{:error, :unknown_provider}` for unsupported providers.
  """
  @spec from_string(String.t()) :: {:ok, t()} | {:error, :unknown_provider}
  def from_string(str) do
    normalized = str |> String.trim() |> String.downcase()

    case normalized do
      "deepseek" -> {:ok, :deepseek}
      "openai" -> {:ok, :openai}
      "anthropic" -> {:ok, :anthropic}
      _ -> {:error, :unknown_provider}
    end
  end

  @doc "Returns all supported providers as atoms."
  @spec supported() :: [t()]
  def supported, do: @supported

  @doc "Converts a provider atom to its environment variable name."
  @spec to_env_var(t()) :: String.t()
  def to_env_var(:deepseek), do: "DEEPSEEK_API_KEY"
  def to_env_var(:openai), do: "OPENAI_API_KEY"
  def to_env_var(:anthropic), do: "ANTHROPIC_API_KEY"

  @doc "Converts a provider atom to its Thalamus query param value (downcase string)."
  @spec to_query_param(t()) :: String.t()
  def to_query_param(provider), do: Atom.to_string(provider)
end
