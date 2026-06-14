/**
 * RestSandboxProvider — connects to Soma's /api/v1/files REST API.
 *
 * This is the default provider when no custom sandbox is passed to GliaFileBrowser.
 */

import type { SandboxProvider, SandboxFile } from './types'

export interface RestSandboxOptions {
  baseUrl?: string
  apiKey?: string
  authHeaders?: () => Record<string, string>
}

export function createRestSandboxProvider(options: RestSandboxOptions = {}): SandboxProvider {
  const base = options.baseUrl || ''
  const getHeaders = options.authHeaders || (() => options.apiKey ? { 'x-api-key': options.apiKey } : {})

  async function apiFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...getHeaders(), ...(init?.headers as Record<string, string> || {}) } as HeadersInit,
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
    return res.json()
  }

  return {
    async listFiles(p: string): Promise<SandboxFile[]> {
      const data = await apiFetch(`/api/v1/files?path=${encodeURIComponent(p)}`)
      return (data.files || []).map((f: any) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        ext: f.ext,
      }))
    },

    async readFile(p: string): Promise<string> {
      const res = await fetch(`${base}/api/v1/files/content?path=${encodeURIComponent(p)}`, {
        headers: getHeaders() as HeadersInit,
      })
      if (!res.ok) throw new Error(`Read failed: ${res.status}`)
      return res.text()
    },

    async writeFile(p: string, content: string): Promise<void> {
      const name = p.split('/').pop() || 'file'
      const dir = p.split('/').slice(0, -1).join('/')
      const data = btoa(unescape(encodeURIComponent(content)))
      await apiFetch('/api/v1/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data, path: dir }),
      })
    },

    async deleteFile(p: string): Promise<void> {
      await apiFetch(`/api/v1/files?path=${encodeURIComponent(p)}`, { method: 'DELETE' })
    },

    async mkdir(p: string): Promise<void> {
      await apiFetch('/api/v1/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: p }),
      })
    },
  }
}
