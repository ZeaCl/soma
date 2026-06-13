'use client'

import React from 'react'
import type { GliaFile } from '../types'

interface GliaFileBrowserProps {
  files: GliaFile[]
  loading?: boolean
  onSelect?: (file: GliaFile) => void
  onUpload?: (name: string, data: string, path?: string) => Promise<boolean>
  onMkdir?: (path: string) => Promise<void>
  onDelete?: (path: string) => Promise<void>
  onRename?: (path: string, newName: string) => Promise<void>
}

export function GliaFileBrowser({ files, loading, onSelect }: GliaFileBrowserProps) {
  if (loading) return <div className="p-4 text-sm text-gray-400">Cargando...</div>
  if (files.length === 0) return <div className="p-4 text-sm text-gray-400">No hay archivos</div>

  return (
    <div className="flex flex-col text-sm">
      {files.map((f, i) => (
        <button key={i} onClick={() => onSelect?.(f)}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 text-left">
          <span>{f.type === 'dir' ? '📁' : f.ext === '.md' ? '📝' : '📄'}</span>
          <span className="truncate flex-1">{f.name}</span>
          {f.type === 'file' && <span className="text-xs text-gray-400">{Math.round(f.size / 1024)}KB</span>}
        </button>
      ))}
    </div>
  )
}
