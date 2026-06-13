'use client'

import React from 'react'

interface GliaConversationListProps {
  conversations: Array<{ id: string; title: string; lastMessageAt: string; messageCount: number }>
  activeId?: string
  onSelect?: (id: string) => void
  onNew?: (agentId: string) => void
  agents?: Array<{ id: string; name: string }>
}

export function GliaConversationList({ conversations, activeId, onSelect, agents = [] }: GliaConversationListProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      {agents.map(agent => (
        <button key={agent.id} onClick={() => {}}
          className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-medium truncate">{agent.name}</span>
        </button>
      ))}
      {conversations.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No conversations yet</p>
      )}
      {conversations.map(conv => (
        <button key={conv.id} onClick={() => onSelect?.(conv.id)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-100 flex flex-col ${
            activeId === conv.id ? 'bg-blue-50' : ''
          }`}>
          <span className="font-medium truncate">{conv.title || 'Nueva conversación'}</span>
          <span className="text-xs text-gray-400">{conv.messageCount} mensajes</span>
        </button>
      ))}
    </div>
  )
}
