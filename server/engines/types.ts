/**
 * Engine Interface — TypeScript types for multi-engine agent runtime.
 *
 * Every AI engine (Pi, ReAct, OpenCode, Hermes, Goose) implements AgentEngine.
 * The WebSocket protocol is engine-agnostic: all engines emit the same StreamEvent types.
 */

import type { AuthStorage, ModelRegistry, ResourceLoader } from '@earendil-works/pi-coding-agent'

// ── Agent Configuration ─────────────────────────────────────────────────

export interface AgentConfig {
  systemPrompt: string | null
  skillPaths: string[]
  tools: string[]
  workspacePaths: string[]
  sessionDir: string
  modelRegistry: ModelRegistry
  authStorage: AuthStorage
  resourceLoader?: ResourceLoader
}

// ── Stream Events ────────────────────────────────────────────────────────

/**
 * Unified event format emitted by all engines.
 * The client (SDK/CLI) never knows which engine sent the event.
 */
export type StreamEvent =
  | { type: 'thinking_start' }
  | { type: 'thinking'; text: string }
  | { type: 'thinking_end' }
  | { type: 'delta'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'tool_result'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

// ── Agent Session ────────────────────────────────────────────────────────

export interface AgentSession {
  /** Send a user prompt to the agent. Resolves when the response is complete. */
  prompt(text: string): Promise<void>

  /** Subscribe to streaming events (thinking, delta, tool_use, done, error). */
  subscribe(callback: (event: StreamEvent) => void): void

  /** Abort the current prompt. */
  abort(): Promise<void>
}

// ── Agent Engine ─────────────────────────────────────────────────────────

export interface AgentEngine {
  /** Human-readable engine name (e.g. "pi", "react", "opencode"). */
  readonly name: string

  /** Create a new session with the given agent configuration. */
  createSession(config: AgentConfig): Promise<AgentSession>
}
