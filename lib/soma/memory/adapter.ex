defmodule Soma.Memory.Adapter do
  @moduledoc """
  Behaviour común para inyectar memoria y contexto en los diferentes runtimes
  de agentes (#192 Fase 4).

  Runtimes soportados:
  - `pi`: Context Bundle en `~/.pi/agent/context/<conv_id>.json` + extensión
  - `opencode`: Context Bundle en `~/.opencode/context/<conv_id>.json` y `AGENTS.md`
  - `claude_code` / `claude-code`: Context Bundle en `~/.claude/context/<conv_id>.json` y `CLAUDE.md`
  - `glia`: Inyección en estado ReAct de Elixir y/o `~/.glia/context/<conv_id>.json`
  """

  @type bundle :: map()
  @type opts :: keyword()
  @type target :: binary() | map() | struct()

  @callback inject_context(target(), binary(), bundle(), opts()) ::
              {:ok, term()} | {:error, term()}

  @doc """
  Resuelve el módulo adapter para un runtime dado.
  """
  @spec for_runtime(String.t() | atom()) :: {:ok, module()} | {:error, {:unknown_runtime, term()}}
  def for_runtime(runtime) when runtime in ["pi", :pi], do: {:ok, Soma.Memory.Adapters.Pi}

  def for_runtime(runtime) when runtime in ["opencode", :opencode],
    do: {:ok, Soma.Memory.Adapters.Opencode}

  def for_runtime(runtime) when runtime in ["claude-code", "claude_code", :claude_code, :claude],
    do: {:ok, Soma.Memory.Adapters.ClaudeCode}

  def for_runtime(runtime) when runtime in ["glia", :glia], do: {:ok, Soma.Memory.Adapters.Glia}
  def for_runtime(other), do: {:error, {:unknown_runtime, other}}
end
