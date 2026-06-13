/**
 * Engine Registry — pluggable engine discovery.
 *
 * Engines are registered at startup and resolved by name when an agent session is created.
 */

import type { AgentEngine } from './types'

const engines = new Map<string, AgentEngine>()

export const EngineRegistry = {
  /** Register an engine. Must be called before any agent session uses it. */
  register(name: string, engine: AgentEngine): void {
    if (engines.has(name)) {
      console.warn(`⚠️  Engine "${name}" already registered — overwriting`)
    }
    engines.set(name, engine)
    console.log(`🔌 Engine registered: ${name}`)
  },

  /** Resolve an engine by name. Returns undefined if not found. */
  get(name: string): AgentEngine | undefined {
    return engines.get(name)
  },

  /** List all registered engine names. */
  list(): string[] {
    return [...engines.keys()]
  },

  /** Check if an engine is registered. */
  has(name: string): boolean {
    return engines.has(name)
  }
}
