'use client'

import React, { useState } from 'react'
import { GliaChat } from './GliaChat'

interface GliaCopilotProps {
  agentId: string
  apiKey?: string
  baseUrl?: string
  open?: boolean
  onClose?: () => void
}

export function GliaCopilot({ agentId, apiKey, baseUrl, open = false, onClose }: GliaCopilotProps) {
  const [isOpen, setIsOpen] = useState(open)
  const [width, setWidth] = useState(440)

  const toggle = () => {
    setIsOpen(!isOpen)
    if (isOpen) onClose?.()
  }

  if (!isOpen) {
    return (
      <button onClick={toggle}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 z-50 flex items-center justify-center text-2xl">
        💬
      </button>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10" onClick={toggle} />
      <aside className="fixed right-0 top-0 h-full z-50 flex flex-col border-l bg-white shadow-xl"
        style={{ width: `${width}px` }}>
        <div className="flex items-center gap-2 p-3 border-b">
          <span className="font-semibold text-sm flex-1">Copilot</span>
          <button onClick={() => {}} className="p-1 hover:bg-gray-100 rounded" title="Refresh">↻</button>
          <button onClick={toggle} className="p-1 hover:bg-gray-100 rounded" title="Close">✕</button>
        </div>
        <GliaChat agentId={agentId} apiKey={apiKey} baseUrl={baseUrl} />
      </aside>
    </>
  )
}
