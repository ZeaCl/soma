defmodule Soma.AIProviderTest do
  use ExUnit.Case, async: true

  alias Soma.AIProvider

  describe "from_string/1" do
    test "accepts lowercase" do
      assert {:ok, :deepseek} = AIProvider.from_string("deepseek")
      assert {:ok, :openai} = AIProvider.from_string("openai")
      assert {:ok, :anthropic} = AIProvider.from_string("anthropic")
    end

    test "accepts mixed case" do
      assert {:ok, :deepseek} = AIProvider.from_string("DeepSeek")
      assert {:ok, :deepseek} = AIProvider.from_string("DEEPSEEK")
      assert {:ok, :openai} = AIProvider.from_string("OpenAI")
      assert {:ok, :anthropic} = AIProvider.from_string("AnThRoPiC")
    end

    test "accepts with whitespace" do
      assert {:ok, :deepseek} = AIProvider.from_string("  deepseek  ")
      assert {:ok, :openai} = AIProvider.from_string("\topenai\n")
    end

    test "rejects unknown providers" do
      assert {:error, :unknown_provider} = AIProvider.from_string("google")
      assert {:error, :unknown_provider} = AIProvider.from_string("")
      assert {:error, :unknown_provider} = AIProvider.from_string("   ")
    end
  end

  describe "to_env_var/1" do
    test "returns correct env var names" do
      assert AIProvider.to_env_var(:deepseek) == "DEEPSEEK_API_KEY"
      assert AIProvider.to_env_var(:openai) == "OPENAI_API_KEY"
      assert AIProvider.to_env_var(:anthropic) == "ANTHROPIC_API_KEY"
    end
  end

  describe "to_query_param/1" do
    test "returns downcase string" do
      assert AIProvider.to_query_param(:deepseek) == "deepseek"
      assert AIProvider.to_query_param(:openai) == "openai"
      assert AIProvider.to_query_param(:anthropic) == "anthropic"
    end
  end

  describe "supported/0" do
    test "returns all providers" do
      assert AIProvider.supported() == [:deepseek, :openai, :anthropic]
    end
  end
end
