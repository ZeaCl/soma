const CORTEX_URL = process.env.CORTEX_URL ?? 'http://localhost:4000/api/chat'
const CORTEX_API_KEY = process.env.CORTEX_API_KEY ?? ''

export interface CortexMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface CortexResponse {
  content: string
}

export async function cortexChat(messages: CortexMessage[]): Promise<string> {
  const res = await fetch(CORTEX_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CORTEX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, stream: false }),
  })

  if (!res.ok) {
    throw new Error(`Cortex error ${res.status}: ${await res.text()}`)
  }

  // Cortex responde con SSE incluso con stream:false
  // formato: data: {"content":"..."}\n\nevent: done\ndata: {"done":true}\n\n
  const text = await res.text()
  const lines = text.split('\n')
  const chunks: string[] = []

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const parsed = JSON.parse(line.slice(6))
        if (parsed.content) chunks.push(parsed.content)
      } catch {
        // ignorar líneas no-JSON
      }
    }
  }

  return chunks.join('')
}
