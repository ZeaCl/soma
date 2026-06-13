/**
 * Goose Engine — Block's open-source agent (block.github.io/goose).
 *
 * Stub — not yet implemented.
 */

import type { AgentEngine } from './types'

export const GooseEngine: AgentEngine = {
  name: 'goose',
  async createSession(_config) {
    throw new Error('Goose engine: not implemented')
  }
}
