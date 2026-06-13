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

  const wsUrl = baseUrl
    ? `${baseUrl.replace('http', 'ws')}/agent-ws`
    : `ws://${typeof window !== 'undefined' ? window.location.host : 'localhost'}/agent-ws`

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'init', uid: agentId, cid: conversationId }))
    }

    ws.onmessage = (event) => {
      try {
        // Handle both text and binary WebSocket messages
        let raw = event.data
        if (typeof raw !== 'string') {
          raw = Array.isArray(raw) || raw instanceof ArrayBuffer
            ? new TextDecoder().decode(raw)
            : typeof raw === 'object' && raw.text ? raw.text() : ''
        }
        const d: GliaStreamEvent = JSON.parse(raw)
        switch (d.type) {
          case 'ready':
            readyRef.current = true
            setIsConnected(true)
            for (const t of pendingRef.current) {
              ws.send(JSON.stringify({ type: 'prompt', text: t }))
            }
            pendingRef.current = []
            break
          case 'thinking_start':
            setIsStreaming(true)
            break
          case 'thinking':
            onThinking?.(d.text)
            break
          case 'thinking_end':
            break
          case 'delta':
            streamRef.current += d.text
            setStreamContent(streamRef.current)
            onDelta?.(d.text)
            break
          case 'tool':
            onTool?.(d.name, d.input)
            break
          case 'done':
            setIsStreaming(false)
            if (streamRef.current) {
              setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: streamRef.current,
                timestamp: new Date(),
              }])
              streamRef.current = ''
              setStreamContent('')
            }
            onDone?.()
            break
          case 'cancelled':
            setIsStreaming(false)
            if (streamRef.current) {
              setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: streamRef.current + '\n\n_⏹️ Cancelado_',
                timestamp: new Date(),
              }])
              streamRef.current = ''
              setStreamContent('')
            }
            onCancelled?.()
            break
          case 'error':
            setIsStreaming(false)
            onError?.(d.message)
            break
        }
      } catch { /* ignore */ }
    }

    ws.onclose = () => { setIsConnected(false) }
    ws.onerror = () => onError?.('Connection error')
    wsRef.current = ws
  }, [wsUrl, agentId, conversationId])

  useEffect(() => {
    connect()
    return () => { wsRef.current?.close() }
  }, [connect])

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
