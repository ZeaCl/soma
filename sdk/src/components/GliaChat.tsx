'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useGlia } from '../hooks/useGlia'

interface GliaChatProps {
  agentId: string
  conversationId?: string
  apiKey?: string
  baseUrl?: string
  placeholder?: string
  welcomeMessage?: string
  suggestions?: Array<{ icon: string; label: string }>
  className?: string
}

export function GliaChat({
  agentId,
  conversationId,
  apiKey,
  baseUrl,
  placeholder = 'Mensaje para el agente...',
  welcomeMessage = '¡Hola! Soy tu agente. ¿En qué puedo ayudarte?',
  suggestions = [],
  className = '',
}: GliaChatProps) {
  const { send, cancel, isConnected, isStreaming, messages, streamContent } = useGlia({
    agentId,
    conversationId,
    apiKey,
    baseUrl,
  })
  const [input, setInput] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamContent])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    send(text)
    setInput('')
  }

  const handleCancel = () => {
    setCancelling(true)
    cancel()
  }

  useEffect(() => {
    if (!isStreaming) setCancelling(false)
  }, [isStreaming])

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-[40%]">{welcomeMessage}</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {isStreaming && streamContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm bg-gray-100">
              <div className="whitespace-pre-wrap">{streamContent}</div>
            </div>
          </div>
        )}
        {isStreaming && !streamContent && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 text-sm text-gray-400">Pensando...</div>
          </div>
        )}
      </div>

      <div className="border-t p-3">
        {suggestions.length > 0 && !isStreaming && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setInput(s.label)}
                className="shrink-0 px-3 py-1 rounded-full text-xs border hover:bg-gray-50">
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 border rounded-xl p-2 bg-gray-50">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={isStreaming ? 'El agente está respondiendo...' : placeholder}
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none border-none bg-transparent outline-none text-sm p-1"
            style={{ opacity: isStreaming ? 0.5 : 1 }}
          />
          {isStreaming ? (
            <button onClick={handleCancel} disabled={cancelling}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white text-lg"
              title="Detener">
              {cancelling ? '⏳' : '■'}
            </button>
          ) : (
            <button onClick={handleSend}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white"
              style={{ opacity: input.trim() ? 1 : 0.4 }}>
              ↑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
