'use client'

import React, { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

export interface WorkspaceFile {
  name: string
  type: 'file' | 'dir'
  size: number
  ext?: string
}

export interface UserWorkspaceProps {
  /** Tipo de owner: 'user' | 'agent' | 'org' */
  ownerType?: 'user' | 'agent' | 'org'
  /** ID del usuario/agente/org */
  ownerId: string
  /** Org ID para workspace compartido */
  orgId?: string
  /** URL base de Soma */
  baseUrl?: string
  /** API key o factory de auth headers */
  authHeaders?: () => Record<string, string>
  /** Color scheme override */
  colors?: Partial<UserWorkspaceColors>
  /** Callback al seleccionar archivo */
  onSelectFile?: (file: WorkspaceFile) => void
  /** Mostrar uploader */
  showUpload?: boolean
}

export interface UserWorkspaceColors {
  bg: string
  surface: string
  border: string
  text: string
  textSecondary: string
  primary: string
  error: string
  success: string
  radius: string
}

const defaultColors: UserWorkspaceColors = {
  bg: '#0d1117',
  surface: '#161b22',
  border: '#21262d',
  text: '#e6edf3',
  textSecondary: '#8b949e',
  primary: '#58a6ff',
  error: '#f85149',
  success: '#3fb950',
  radius: '6px',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(f: WorkspaceFile): string {
  if (f.type === 'dir') return '📁'
  const ext = (f.ext || '').toLowerCase()
  if (['.md', '.markdown'].includes(ext)) return '📝'
  if (['.json'].includes(ext)) return '📋'
  if (['.py'].includes(ext)) return '🐍'
  if (['.js', '.ts', '.tsx', '.jsx'].includes(ext)) return '⚡'
  if (['.xlsx', '.xls'].includes(ext)) return '📊'
  if (['.csv'].includes(ext)) return '📈'
  if (['.pdf'].includes(ext)) return '📕'
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) return '🖼️'
  if (['.txt', '.log'].includes(ext)) return '📄'
  return '📄'
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useUserWorkspace(options: {
  ownerType: 'user' | 'agent' | 'org'
  ownerId: string
  orgId?: string
  baseUrl?: string
  authHeaders?: () => Record<string, string>
}) {
  const { ownerType, ownerId, orgId, baseUrl, authHeaders } = options
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState('')

  const apiBase = baseUrl || ''

  const getHeaders = useCallback(() => {
    if (authHeaders) return authHeaders()
    return {} as Record<string, string>
  }, [authHeaders])

  const fetchFiles = useCallback(async (path?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        owner_type: ownerType,
        owner_id: ownerId,
      })
      if (path) params.set('path', path)
      if (orgId) params.set('org_id', orgId)

      const res = await fetch(`${apiBase}/api/files/unified?${params}`, {
        headers: getHeaders(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFiles(data.files || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [apiBase, ownerType, ownerId, orgId, getHeaders])

  const navigateTo = useCallback((dirName: string) => {
    const newPath = currentPath ? `${currentPath}/${dirName}` : dirName
    setCurrentPath(newPath)
    fetchFiles(newPath)
  }, [currentPath, fetchFiles])

  const navigateUp = useCallback(() => {
    const parts = currentPath.split('/')
    parts.pop()
    const newPath = parts.join('/')
    setCurrentPath(newPath)
    fetchFiles(newPath)
  }, [currentPath, fetchFiles])

  const upload = useCallback(async (name: string, data: string, path?: string) => {
    try {
      const res = await fetch(`${apiBase}/api/files/unified/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({
          owner_type: ownerType,
          owner_id: ownerId,
          name,
          data: btoa(data),
          path: path || currentPath,
        }),
      })
      const result = await res.json()
      if (result.ok) {
        await fetchFiles(currentPath)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [apiBase, ownerType, ownerId, currentPath, fetchFiles, getHeaders])

  useEffect(() => { fetchFiles() }, [])

  return {
    files, loading, error,
    currentPath, setCurrentPath,
    fetchFiles, navigateTo, navigateUp, upload,
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function UserWorkspace({
  ownerType = 'user',
  ownerId,
  orgId,
  baseUrl,
  authHeaders,
  colors: colorOverrides,
  onSelectFile,
  showUpload = true,
}: UserWorkspaceProps) {
  const c = { ...defaultColors, ...colorOverrides }
  const ws = useUserWorkspace({ ownerType, ownerId, orgId, baseUrl, authHeaders })
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileClick = async (f: WorkspaceFile) => {
    if (f.type === 'dir') {
      ws.navigateTo(f.name)
      return
    }
    onSelectFile?.(f)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const data = reader.result as string
      // Remove data URL prefix if present
      const base64 = data.includes('base64,') ? data.split('base64,')[1] : btoa(data)
      await ws.upload(file.name, base64)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  if (preview) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: `1px solid ${c.border}`, background: c.surface,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: c.text }}>📄 {preview.name}</span>
          <button onClick={() => setPreview(null)} style={{
            background: 'none', border: 'none', color: c.textSecondary, cursor: 'pointer', fontSize: 13,
          }}>← Volver</button>
        </div>
        <div style={{
          flex: 1, overflow: 'auto', padding: 16, background: c.bg, color: c.text,
          fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {preview.content || '(archivo vacío)'}
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: `1px solid ${c.border}`, background: c.surface,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: c.textSecondary, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '.04em' }}>
          {ownerType === 'user' ? '👤 Mi Workspace' : ownerType === 'agent' ? '🤖 Agent Workspace' : '🏢 Org Workspace'}
        </span>
        <span style={{ flex: 1 }} />
        {showUpload && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
            background: c.primary, color: '#fff', borderRadius: c.radius,
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            {uploading ? '⏳' : '📤'} {uploading ? 'Subiendo...' : 'Upload'}
            <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {/* Breadcrumb */}
      {ws.currentPath && (
        <div style={{
          padding: '6px 12px', borderBottom: `1px solid ${c.border}`,
          fontSize: 12, color: c.textSecondary, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <button onClick={ws.navigateUp} style={{
            background: 'none', border: 'none', color: c.primary, cursor: 'pointer', fontSize: 12, padding: 0,
          }}>..</button>
          <span>/</span>
          {ws.currentPath.split('/').map((part, i, arr) => (
            <span key={i}>
              <span
                onClick={() => {
                  const p = arr.slice(0, i + 1).join('/')
                  ws.setCurrentPath(p)
                  ws.fetchFiles(p)
                }}
                style={{ cursor: 'pointer', color: i === arr.length - 1 ? c.text : c.primary }}
              >
                {part}
              </span>
              {i < arr.length - 1 && <span style={{ color: c.textSecondary }}> / </span>}
            </span>
          ))}
        </div>
      )}

      {/* File list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {ws.loading ? (
          <div style={{ padding: 16, color: c.textSecondary, fontSize: 13 }}>Cargando...</div>
        ) : ws.error ? (
          <div style={{ padding: 16, color: c.error, fontSize: 13 }}>{ws.error}</div>
        ) : ws.files.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: c.textSecondary, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            {showUpload ? 'Arrastrá archivos o clickeá Upload' : 'No hay archivos'}
          </div>
        ) : (
          <SortedFileTable
            files={ws.files}
            onFileClick={handleFileClick}
            colors={c}
          />
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SortedFileTable({
  files, onFileClick, colors: c,
}: {
  files: WorkspaceFile[]
  onFileClick: (f: WorkspaceFile) => void
  colors: UserWorkspaceColors
}) {
  const sorted = [...files].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${c.border}` }}>
          <th style={{ padding: '6px 12px', textAlign: 'left', color: c.textSecondary, fontWeight: 500, width: 30 }}></th>
          <th style={{ padding: '6px 12px', textAlign: 'left', color: c.textSecondary, fontWeight: 500 }}>Nombre</th>
          <th style={{ padding: '6px 12px', textAlign: 'left', color: c.textSecondary, fontWeight: 500, width: 80 }}>Tipo</th>
          <th style={{ padding: '6px 12px', textAlign: 'right', color: c.textSecondary, fontWeight: 500, width: 80 }}>Tamaño</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((f, i) => (
          <tr key={i}
            onClick={() => onFileClick(f)}
            style={{
              cursor: 'pointer',
              borderBottom: `1px solid ${c.border}`,
              background: i % 2 === 0 ? c.surface : c.bg,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `${c.primary}10`)}
            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? c.surface : c.bg)}
          >
            <td style={{ padding: '6px 12px', textAlign: 'center' }}>{fileIcon(f)}</td>
            <td style={{ padding: '6px 12px', color: f.type === 'dir' ? c.primary : c.text }}>
              {f.name}
            </td>
            <td style={{ padding: '6px 12px', color: c.textSecondary }}>
              {f.type === 'dir' ? 'Directorio' : (f.ext || 'archivo')}
            </td>
            <td style={{ padding: '6px 12px', textAlign: 'right', color: c.textSecondary }}>
              {f.type === 'file' ? formatSize(f.size) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default UserWorkspace
