export interface GliaMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  tools?: Array<{ name: string; input: unknown; result?: string }>
  timestamp: Date
}

export interface GliaConversation {
  id: string
  title: string
  lastMessageAt: string
  messageCount: number
}

export interface GliaFile {
  name: string
  type: 'file' | 'dir'
  size: number
  ext?: string
}

export interface GliaSkill {
  name: string
  description: string
  builtin: boolean
  custom: boolean
  agents?: string[]
}

export interface GliaAgent {
  id: string
  email: string
  is_agent: boolean
  agent_config?: {
    skills: string[]
    system_prompt?: string
    workspace_paths?: string[]
    engine?: 'pi' | 'glia'
  }
}

export type GliaStreamEvent =
  | { type: 'thinking_start' }
  | { type: 'thinking'; text: string }
  | { type: 'thinking_end' }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; input: unknown }
  | { type: 'tool_result'; content: string }
  | { type: 'done' }
  | { type: 'cancelled' }
  | { type: 'error'; message: string }
  | { type: 'ready' }

export interface UseGliaOptions {
  agentId: string
  conversationId?: string
  apiKey?: string
  baseUrl?: string
  /** WebSocket path override (default: '/agent-ws') */
  wsPath?: string
  /** REST API prefix for hooks (default: '/api/v1') */
  apiPrefix?: string
  /** Custom auth headers factory. Default uses x-api-key header. */
  authHeaders?: () => Record<string, string>
  /** Called on 401/403 responses */
  onAuthError?: (status: number) => void
  /** Direct agent config — bypasses identity service */
  agentConfig?: {
    systemPrompt?: string
    tools?: string[]
    engine?: string
    skills?: string[]
  }
  onDelta?: (text: string) => void
  onThinking?: (text: string) => void
  onTool?: (name: string, input: unknown) => void
  onDone?: () => void
  onCancelled?: () => void
  onError?: (message: string) => void
}

export interface UseGliaReturn {
  send: (text: string) => void
  cancel: () => void
  isConnected: boolean
  isStreaming: boolean
  messages: GliaMessage[]
  streamContent: string
  reconnect: () => void
}
