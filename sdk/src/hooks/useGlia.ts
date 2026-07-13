'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { UseGliaOptions, UseGliaReturn, GliaMessage, GliaStreamEvent } from '../types'

export function useGlia(options: UseGliaOptions): UseGliaReturn {
  const {
    agentId,
    conversationId = `dm:${agentId}`,
    apiKey,
    baseUrl = '',
    onDelta, onThinking, onTool, onDone, onCancelled, onError,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const readyRef = useRef(false)
  const pendingRef = useRef<string[]>([])
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [messages, setMessages] = useState<GliaMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const streamRef = useRef('')
  const historyLoaded = useRef(false)

  const wsUrl = baseUrl
    ? `${baseUrl.replace('https', 'wss').replace('http', 'ws')}${options.wsPath || '/agent-ws'}`
    : `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws'}://${typeof window !== 'undefined' ? window.location.host : 'localhost'}${options.wsPath || '/agent-ws'}`

  const contentRef = useRef('')
  const thinkingRef = useRef('')

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(wsUrl)
    // Ensure we receive ArrayBuffer (not Blob) for binary frames
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      console.log('[useGlia] ws open → sending init')
      ws.send(JSON.stringify({ type: 'init', uid: agentId, cid: conversationId, token: apiKey || '' }))
    }

    ws.onmessage = (event) => {
      try {
        // Handle text, ArrayBuffer, and Blob WebSocket messages
        let raw: string
        if (typeof event.data === 'string') {
          raw = event.data
        } else if (event.data instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(event.data)
        } else if (event.data instanceof Blob) {
          // Blob fallback — should not happen with binaryType='arraybuffer',
          // but handle it gracefully instead of failing silently.
          event.data.text().then((text: string) => {
            processMessage(text, ws)
          }).catch(() => {})
          return
        } else {
          console.warn('[useGlia] unknown message type:', typeof event.data, event.data)
          return
        }
        processMessage(raw, ws)
      } catch (e) {
        console.error('[useGlia] onmessage error:', e, 'raw type:', typeof event.data)
      }
    }

    function processMessage(raw: string, ws: WebSocket) {
      const d: GliaStreamEvent = JSON.parse(raw)
      switch (d.type) {
        case 'ready':
          readyRef.current = true
          setIsConnected(true)
          console.log('[useGlia] ← ready, pending:', pendingRef.current.length)
          for (const t of pendingRef.current) {
            ws.send(JSON.stringify({ type: 'prompt', text: t }))
          }
          pendingRef.current = []
          break
        case 'thinking_start':
          setIsStreaming(true)
          thinkingRef.current = ''
          break
        case 'thinking':
          thinkingRef.current += d.text
          onThinking?.(d.text)
          break
        case 'thinking_end':
          break
        case 'delta':
          streamRef.current += d.text
          contentRef.current = streamRef.current
          setStreamContent(streamRef.current)
          onDelta?.(d.text)
          break
        case 'tool':
          onTool?.(d.name, d.input)
          break
        case 'done': {
          setIsStreaming(false)
          // contentRef mirrors streamRef — always synchronous, never stale.
          const content = contentRef.current || streamRef.current
          console.log('[useGlia] ← done, content length:', content.length, 'contentRef:', !!contentRef.current, 'streamRef:', !!streamRef.current)
          const thinking = thinkingRef.current.trim() || undefined
          console.log('[useGlia] ← done, content:', content.length, 'thinking:', (thinking || '').length, 'contentRef:', !!contentRef.current)
          if (content || thinking) {
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: content || '(sin respuesta)',
              thinking,
              timestamp: new Date(),
            }])
            contentRef.current = ''
            streamRef.current = ''
            thinkingRef.current = ''
            setStreamContent('')
          } else {
            console.warn('[useGlia] ← done but NO content accumulated — message lost')
          }
          onDone?.()
          break
        }
        case 'cancelled': {
          setIsStreaming(false)
          const content = contentRef.current || streamRef.current || ''
          if (content) {
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: content + '\n\n_⏹️ Cancelado_',
              thinking: thinkingRef.current.trim() || undefined,
              timestamp: new Date(),
            }])
            contentRef.current = ''
            streamRef.current = ''
            thinkingRef.current = ''
            setStreamContent('')
          }
          onCancelled?.()
          break
        }
        case 'error':
          setIsStreaming(false)
          console.error('[useGlia] ← error:', d.message)
          onError?.(d.message)
          break
      }
    }

    ws.onclose = () => { setIsConnected(false); console.log('[useGlia] ws closed') }
    ws.onerror = () => { console.error('[useGlia] ws error'); onError?.('Connection error') }
    wsRef.current = ws
  }, [wsUrl, agentId, conversationId])

  useEffect(() => {
    // Cargar historial antes de conectar
    if (!historyLoaded.current && apiKey && conversationId) {
      historyLoaded.current = true
      const api = baseUrl ? `${baseUrl}/api/conversations/${encodeURIComponent(conversationId)}` : ''
      if (api) {
        fetch(api, { headers: { Authorization: `Bearer ${apiKey}` } })
          .then(r => r.json())
          .then(d => {
            if (d.messages?.length) setMessages(d.messages.map((m: any) => ({
              id: m.id || crypto.randomUUID(),
              role: m.role,
              content: m.content,
              thinking: m.thinking,
              tools: m.tools,
              timestamp: new Date(m.timestamp || Date.now()),
            })))
          })
          .catch(() => {})
      }
    }
    connect()
    return () => { wsRef.current?.close() }
  }, [agentId, conversationId])

  const send = useCallback((text: string) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date(),
    }])
    if (readyRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'prompt', text }))
    } else {
      pendingRef.current.push(text)
      connect()
    }
  }, [connect])

  const cancel = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'cancel' }))
  }, [])

  const reconnect = useCallback(() => {
    wsRef.current?.close()
    connect()
  }, [connect])

  return { send, cancel, isConnected, isStreaming, messages, streamContent, reconnect }
}
