'use client'

import React, { useState, useCallback } from 'react'
import type { WorkspaceFile } from './UserWorkspace'

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserFileDropZoneProps {
  /** Called when files are successfully uploaded */
  onUploaded?: () => void
  /** Upload function: (name, base64data, path?) => Promise<boolean> */
  onUpload: (name: string, base64data: string, path?: string) => Promise<boolean>
  /** Current directory path for upload */
  currentPath?: string
  /** Accepted file extensions */
  accept?: string
  /** Custom colors */
  colors?: {
    bg?: string
    border?: string
    primary?: string
    text?: string
    textSecondary?: string
  }
  /** Disable drag-and-drop */
  disableDrag?: boolean
}

const defaultDropColors = {
  bg: '#0d1117',
  border: '#21262d',
  primary: '#58a6ff',
  text: '#e6edf3',
  textSecondary: '#8b949e',
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Drag-and-drop file upload zone.
 * Generic — works with any upload backend.
 * Drop here, use in sidebar or main content area.
 */
export function UserFileDropZone({
  onUploaded,
  onUpload,
  currentPath,
  accept = '.xlsx,.xls,.csv,.pdf,.json,.md,.py,.txt,.ts,.js,.yml,.yaml',
  colors: cOverride,
  disableDrag,
}: UserFileDropZoneProps) {
  const c = { ...defaultDropColors, ...cOverride }
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dragCounter = React.useRef(0)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setMessage(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.includes('base64,') ? result.split('base64,')[1] : result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const ok = await onUpload(file.name, base64, currentPath)
      if (ok) {
        setMessage(`✅ ${file.name}`)
        onUploaded?.()
      } else {
        setMessage(`❌ Error`)
      }
    } catch {
      setMessage('❌ Error')
    } finally {
      setUploading(false)
      setTimeout(() => setMessage(null), 2500)
    }
  }, [onUpload, currentPath, onUploaded])

  const handleDragEnter = (e: React.DragEvent) => {
    if (disableDrag) return
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (disableDrag) return
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    if (disableDrag) return
    e.preventDefault()
    setDragging(false)
    dragCounter.current = 0
    Array.from(e.dataTransfer.files).forEach(uploadFile)
  }

  return (
    <div style={{ padding: '4px 12px' }}>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          borderRadius: 6,
          border: `1px dashed ${dragging ? c.primary : c.border}`,
          padding: '8px 12px',
          textAlign: 'center',
          cursor: 'pointer',
          fontSize: 12,
          color: c.textSecondary,
          fontFamily: 'system-ui, sans-serif',
          background: dragging ? `${c.primary}10` : 'transparent',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        {uploading ? (
          <span>⏳ Subiendo...</span>
        ) : message ? (
          <span>{message}</span>
        ) : (
          <span>📤 {disableDrag ? 'Click para subir' : 'Arrastrá archivos o click'}</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => {
            Array.from(e.target.files || []).forEach(uploadFile)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

export default UserFileDropZone
