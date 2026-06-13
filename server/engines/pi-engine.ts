/**
 * Pi Engine — wraps @earendil-works/pi-coding-agent.
 *
 * Translates Pi's internal event format to the unified StreamEvent protocol.
 * Tool execution uses sudo -u for kernel-level sandbox isolation.
 */

import { createAgentSession, SessionManager } from '@earendil-works/pi-coding-agent'
import { join } from 'path'
import type { AgentEngine, AgentConfig, AgentSession, StreamEvent } from './types'

export const PiEngine: AgentEngine = {
  name: 'pi',

  async createSession(config: AgentConfig): Promise<AgentSession> {
    const sm = SessionManager.continueRecent(process.cwd(), config.sessionDir)

    const result = await createAgentSession({
      sessionManager: sm,
      authStorage: config.authStorage,
      modelRegistry: config.modelRegistry,
      tools: config.tools as any,
      ...(config.resourceLoader ? { resourceLoader: config.resourceLoader } : {}),
      ...(config.systemPrompt ? { systemPromptOverride: config.systemPrompt } : {}),
    })

    return {
      prompt: (text: string) => result.session.prompt(text),

      subscribe: (callback: (event: StreamEvent) => void) => {
        result.session.subscribe((event: any) => {
          if (event.type !== 'message_update') return
          const msg = event.assistantMessageEvent

          switch (msg.type) {
            case 'thinking_start':
              callback({ type: 'thinking_start' })
              break
            case 'thinking_delta':
              callback({ type: 'thinking', text: msg.delta })
              break
            case 'thinking_end':
              callback({ type: 'thinking_end' })
              break
            case 'text_delta':
              callback({ type: 'delta', text: msg.delta })
              break
            case 'tool_use':
              callback({ type: 'tool_use', name: msg.name, input: msg.input })
              break
            case 'tool_result':
              callback({ type: 'tool_result', content: msg.content })
              break
          }
        })
      },

      abort: () => result.session.abort(),
    }
  }
}
