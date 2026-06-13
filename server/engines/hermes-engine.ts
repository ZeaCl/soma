/**
 * Hermes Engine — fast, lightweight agent.
 *
 * Stub — not yet implemented.
 */

import type { AgentEngine } from './types'

export const HermesEngine: AgentEngine = {
  name: 'hermes',
  async createSession(_config) {
    throw new Error('Hermes engine: not implemented')
  }
}
