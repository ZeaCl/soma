'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GliaConversation, GliaFile, GliaSkill, GliaAgent } from '../types'

const apiFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, options)

// ── Conversations ──────────────────────────────

export function useGliaConversations(apiKey: string, baseUrl = '') {
  const [conversations, setConversations] = useState<GliaConversation[]>([])
  const [loading, setLoading] = useState(true)
  const api = `${baseUrl || ''}/api/v1`

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/conversations`, {
        headers: { 'x-api-key': apiKey }
      })
      if (res.ok) {
        const { data } = await res.json()
        setConversations(data)
      }
    } catch { /* offline */ }
    setLoading(false)
  }, [api, apiKey])

  useEffect(() => { refresh() }, [refresh])

  return { conversations, loading, refresh }
}

// ── Files ─────────────────────────────────────

export function useGliaFiles(apiKey: string, baseUrl = '') {
  const [files, setFiles] = useState<GliaFile[]>([])
  const [loading, setLoading] = useState(true)
  const api = `${baseUrl || ''}/api/v1`

  const refresh = useCallback(async (subpath = '') => {
    setLoading(true)
    try {
      const res = await apiFetch(`${api}/files?path=${encodeURIComponent(subpath)}`, {
        headers: { 'x-api-key': apiKey }
      })
      if (res.ok) {
        const { files: data } = await res.json()
        setFiles(data)
      }
    } catch { /* offline */ }
    setLoading(false)
  }, [api, apiKey])

  useEffect(() => { refresh() }, [refresh])

  const upload = async (name: string, data: string, path = '') => {
    const res = await apiFetch(`${api}/files/upload`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data, path })
    })
    if (res.ok) refresh(path)
    return res.ok
  }

  const mkdir = async (path: string) => {
    const res = await apiFetch(`${api}/files/mkdir`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    })
    if (res.ok) refresh()
  }

  const remove = async (path: string) => {
    const res = await apiFetch(`${api}/files?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers: { 'x-api-key': apiKey }
    })
    if (res.ok) refresh()
  }

  const rename = async (path: string, newName: string) => {
    const res = await apiFetch(`${api}/files/rename`, {
      method: 'PUT',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, newName })
    })
    if (res.ok) refresh()
  }

  return { files, loading, refresh, upload, mkdir, remove, rename }
}

// ── Skills ────────────────────────────────────

export function useGliaSkills(apiKey: string, baseUrl = '') {
  const [skills, setSkills] = useState<GliaSkill[]>([])
  const [loading, setLoading] = useState(true)
  const api = `${baseUrl || ''}/api/v1`

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/skills`, { headers: { 'x-api-key': apiKey } })
      if (res.ok) {
        const { data } = await res.json()
        setSkills(data)
      }
    } catch { /* offline */ }
    setLoading(false)
  }, [api, apiKey])

  useEffect(() => { refresh() }, [refresh])

  const create = async (name: string, content: string) => {
    const res = await apiFetch(`${api}/skills`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    })
    if (res.ok) refresh()
    return res.ok
  }

  const deleteSkill = async (name: string) => {
    await apiFetch(`${api}/skills/${name}`, {
      method: 'DELETE',
      headers: { 'x-api-key': apiKey }
    })
    refresh()
  }

  return { skills, loading, refresh, create, deleteSkill }
}

// ── Agents ────────────────────────────────────

export function useGliaAgents(apiKey: string, baseUrl = '') {
  const [agents, setAgents] = useState<GliaAgent[]>([])
  const [loading, setLoading] = useState(true)
  const api = `${baseUrl || ''}/api/v1`

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`${api}/agents`, { headers: { 'x-api-key': apiKey } })
      if (res.ok) {
        const { data } = await res.json()
        setAgents(data)
      }
    } catch { /* offline */ }
    setLoading(false)
  }, [api, apiKey])

  useEffect(() => { refresh() }, [refresh])

  return { agents, loading, refresh }
}
