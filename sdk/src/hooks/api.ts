'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GliaConversation, GliaFile, GliaSkill, GliaAgent } from '../types'

const apiFetch = (url: string, token: string, options: RequestInit = {}) =>
  fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    }
  })

// ── Conversations ──────────────────────────────

export function useGliaConversations(token: string, baseUrl = '') {
  const [conversations, setConversations] = useState<GliaConversation[]>([])
  const [loading, setLoading] = useState(true)
  const api = `${baseUrl || ''}/api/v1`

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/conversations`, token)
      if (res.ok) {
        const { data } = await res.json()
        setConversations(data)
      }
    } catch { /* offline */ }
    setLoading(false)
  }, [api, token])

  useEffect(() => { refresh() }, [refresh])

  return { conversations, loading, refresh }
}

// ── Files ─────────────────────────────────────

export function useGliaFiles(token: string, baseUrl = '') {
  const [files, setFiles] = useState<GliaFile[]>([])
  const [loading, setLoading] = useState(true)
  const api = `${baseUrl || ''}/api/v1`

  const refresh = useCallback(async (subpath = '') => {
    setLoading(true)
    try {
      const res = await apiFetch(`${api}/files?path=${encodeURIComponent(subpath)}`, token)
      if (res.ok) {
        const { files: data } = await res.json()
        setFiles(data)
      }
    } catch { /* offline */ }
    setLoading(false)
  }, [api, token])

  useEffect(() => { refresh() }, [refresh])

  const upload = async (name: string, data: string, path = '') => {
    const res = await apiFetch(`${api}/files/upload`, token, {
      method: 'POST',
      body: JSON.stringify({ name, data, path })
    })
    if (res.ok) refresh(path)
    return res.ok
  }

  const mkdir = async (path: string) => {
    const res = await apiFetch(`${api}/files/mkdir`, token, {
      method: 'POST',
      body: JSON.stringify({ path })
    })
    if (res.ok) refresh()
  }

  const remove = async (path: string) => {
    await apiFetch(`${api}/files?path=${encodeURIComponent(path)}`, token, { method: 'DELETE' })
    refresh()
  }

  const rename = async (path: string, newName: string) => {
    const res = await apiFetch(`${api}/files/rename`, token, {
      method: 'PUT',
      body: JSON.stringify({ path, newName })
    })
    if (res.ok) refresh()
  }

  return { files, loading, refresh, upload, mkdir, remove, rename }
}

// ── File Content ────────────────────────────

export function useGliaFileContent(token: string, baseUrl = '') {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const api = `${baseUrl || ''}/api/v1`

  const readFile = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`${api}/files/content?path=${encodeURIComponent(path)}`, token)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      setContent(text)
      return text
    } catch (e: any) {
      setError(e.message)
      setContent(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [api, token])

  const clear = useCallback(() => { setContent(null); setError(null) }, [])

  return { content, loading, error, readFile, clear }
}

// ── Skills ────────────────────────────────────

export function useGliaSkills(token: string, baseUrl = '') {
  const [skills, setSkills] = useState<GliaSkill[]>([])
  const [loading, setLoading] = useState(true)
  const api = `${baseUrl || ''}/api/v1`

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/skills`, token)
      if (res.ok) {
        const { data } = await res.json()
        setSkills(data)
      }
    } catch { /* offline */ }
    setLoading(false)
  }, [api, token])

  useEffect(() => { refresh() }, [refresh])

  const create = async (name: string, content: string) => {
    const res = await apiFetch(`${api}/skills`, token, {
      method: 'POST',
      body: JSON.stringify({ name, content })
    })
    if (res.ok) refresh()
    return res.ok
  }

  const deleteSkill = async (name: string) => {
    await apiFetch(`${api}/skills/${name}`, token, { method: 'DELETE' })
    refresh()
  }

  const assignToAgents = async (skillName: string, agentIds: string[]) => {
    const res = await apiFetch(`${api}/skills/${skillName}/agents`, token, {
      method: 'PUT',
      body: JSON.stringify({ agentIds }),
    })
    if (res.ok) refresh()
    return res.ok
  }

  const getAgentSkills = async (agentId: string): Promise<string[]> => {
    try {
      const res = await apiFetch(`${api}/agents/${agentId}/skills`, token)
      if (res.ok) {
        const { data } = await res.json()
        return Array.isArray(data) ? data.map((s: any) => typeof s === 'string' ? s : s.name) : []
      }
    } catch { /* offline */ }
    return []
  }

  const getContent = async (skillName: string): Promise<string | null> => {
    try {
      const res = await apiFetch(`${api}/skills/${skillName}`, token)
      if (res.ok) {
        const { data } = await res.json()
        return data?.content || null
      }
    } catch { /* offline */ }
    return null
  }

  return { skills, loading, refresh, create, deleteSkill, assignToAgents, getAgentSkills, getContent }
}

// ── Agents ────────────────────────────────────

export function useGliaAgents(token: string, baseUrl = '') {
  const [agents, setAgents] = useState<GliaAgent[]>([])
  const [loading, setLoading] = useState(true)
  const api = `${baseUrl || ''}/api/v1`

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/agents`, token)
      if (res.ok) {
        const { data } = await res.json()
        setAgents(data)
      }
    } catch { /* offline */ }
    setLoading(false)
  }, [api, token])

  useEffect(() => { refresh() }, [refresh])

  const createAgent = async (data: { name: string; email: string; password: string; skills?: string[]; system_prompt?: string }) => {
    const res = await apiFetch(`${api}/agents`, token, {
      method: 'POST',
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    const { data: agent } = await res.json()
    setAgents(prev => [...prev, agent])
    return agent
  }

  return { agents, loading, refresh, createAgent }
}
