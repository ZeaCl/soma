'use client'

import React, { useState } from 'react'
import type { GliaFile } from '../types'

export interface GliaFileBrowserProps {
  files: GliaFile[]
  loading?: boolean
  onSelect?: (file: GliaFile) => void
  onUpload?: (name: string, data: string, path?: string) => Promise<boolean>
  onMkdir?: (path: string) => Promise<void>
  onDelete?: (path: string) => Promise<void>
  onRename?: (path: string, newName: string) => Promise<void>
  /** Si se provee, muestra contenido del archivo al clickear */
  readFile?: (path: string) => Promise<string | null>
}

const S = {
  bg: '#0d1117', row: '#161b22', bc: '#21262d',
  tx: '#e6edf3', mu: '#8b949e', pr: '#58a6ff', ha: '#484f58',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(f: GliaFile): string {
  if (f.type === 'dir') return '📁'
  const ext = f.ext?.toLowerCase() || ''
  if (['.md', '.markdown'].includes(ext)) return '📝'
  if (['.json'].includes(ext)) return '📋'
  if (['.js', '.ts', '.tsx', '.jsx'].includes(ext)) return '⚡'
  if (['.txt', '.log'].includes(ext)) return '📄'
  if (['.csv', '.xlsx', '.xls'].includes(ext)) return '📊'
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) return '🖼️'
  return '📄'
}

export function GliaFileBrowser({ files, loading, onSelect, readFile }: GliaFileBrowserProps) {
  const [viewingFile, setViewingFile] = useState<{ name: string; content: string | null; loading: boolean } | null>(null)
  const [currentPath, setCurrentPath] = useState('')

  const handleFileClick = async (f: GliaFile) => {
    if (f.type === 'dir') {
      setCurrentPath(f.name)
      onSelect?.(f)
      return
    }

    if (readFile) {
      setViewingFile({ name: f.name, content: null, loading: true })
      const content = await readFile(f.name)
      setViewingFile({ name: f.name, content, loading: false })
    } else {
      onSelect?.(f)
    }
  }

  const closeViewer = () => setViewingFile(null)

  if (loading) {
    return <div style={{ padding: 16, color: S.mu, fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>Cargando archivos...</div>
  }

  if (files.length === 0) {
    return <div style={{ padding: 16, color: S.mu, fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>No hay archivos.</div>
  }

  // Ordenar: dirs primero, luego alfabético
  const sorted = [...files].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  // ── File viewer inline ──
  if (viewingFile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: `1px solid ${S.bc}`, background: S.row }}>
          <span style={{ fontSize: 12, color: S.tx }}>📄 {viewingFile.name}</span>
          <button onClick={closeViewer} style={{ background: 'none', border: 'none', color: S.mu, cursor: 'pointer', fontSize: 16 }}>← Volver</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16, background: S.bg, color: S.tx, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {viewingFile.loading ? 'Cargando...' : (viewingFile.content || '(archivo vacío)')}
        </div>
      </div>
    )
  }

  // ── Tabla ──
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${S.bc}` }}>
            <th style={{ padding: '6px 12px', textAlign: 'left', color: S.mu, fontWeight: 500, width: 30 }}></th>
            <th style={{ padding: '6px 12px', textAlign: 'left', color: S.mu, fontWeight: 500 }}>Nombre</th>
            <th style={{ padding: '6px 12px', textAlign: 'left', color: S.mu, fontWeight: 500, width: 70 }}>Tipo</th>
            <th style={{ padding: '6px 12px', textAlign: 'right', color: S.mu, fontWeight: 500, width: 80 }}>Tamaño</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((f, i) => (
            <tr key={i}
              onClick={() => handleFileClick(f)}
              style={{
                cursor: 'pointer',
                borderBottom: `1px solid ${S.bc}`,
                background: i % 2 === 0 ? S.row : S.bg,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${S.pr}10`)}
              onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? S.row : S.bg)}
            >
              <td style={{ padding: '6px 12px', textAlign: 'center' }}>{fileIcon(f)}</td>
              <td style={{ padding: '6px 12px', color: f.type === 'dir' ? S.pr : S.tx }}>
                {f.name}
              </td>
              <td style={{ padding: '6px 12px', color: S.mu }}>
                {f.type === 'dir' ? 'Directorio' : (f.ext || 'archivo')}
              </td>
              <td style={{ padding: '6px 12px', textAlign: 'right', color: S.mu }}>
                {f.type === 'file' ? formatSize(f.size) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
