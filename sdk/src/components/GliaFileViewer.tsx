'use client'

import React from 'react'

export interface GliaFileViewerProps {
  content: string | null
  fileName?: string
  loading?: boolean
  error?: string | null
  onClose?: () => void
}

export function GliaFileViewer({ content, fileName, loading, error, onClose }: GliaFileViewerProps) {
  if (loading) {
    return (
      <div style={{ padding: 16, color: '#8b949e', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
        Cargando contenido...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: '#f85149', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
        Error: {error}
      </div>
    )
  }

  if (content === null) {
    return (
      <div style={{ padding: 16, color: '#8b949e', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
        Seleccioná un archivo para ver su contenido.
      </div>
    )
  }

  const isMarkdown = fileName?.endsWith('.md')
  const ext = fileName?.split('.').pop()?.toLowerCase()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid #21262d',
        background: '#161b22', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: '#8b949e' }}>
          📄 {fileName || 'archivo'}
          {ext && <span style={{ marginLeft: 8, color: '#484f58' }}>.{ext}</span>}
        </span>
        {onClose && (
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 16, padding: 0 }}>
            ✕
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, overflow: 'auto', padding: 16,
        background: '#0d1117', color: '#e6edf3',
        fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: isMarkdown ? 'system-ui, sans-serif' : "'SF Mono', 'Fira Code', monospace",
      }}>
        {content}
      </div>

      {/* Footer */}
      <div style={{
        padding: '4px 12px', borderTop: '1px solid #21262d',
        background: '#161b22', fontSize: 10, color: '#484f58',
        flexShrink: 0,
      }}>
        {content.length.toLocaleString()} bytes · {content.split('\n').length} líneas
      </div>
    </div>
  )
}
