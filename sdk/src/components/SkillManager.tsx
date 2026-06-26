'use client'

import React, { useState, useEffect } from 'react'

export interface SkillManagerProps {
  token: string
  somaUrl?: string
  onSkillAssigned?: () => void
}

interface Skill {
  name: string
  description: string
  custom: boolean
  builtin: boolean
  agents?: string[]
}

interface Agent {
  id: string
  name?: string
  email?: string
}

const S = {
  bg: '#0d1117', row: '#161b22', bc: '#21262d',
  tx: '#e6edf3', mu: '#8b949e', pr: '#58a6ff', ha: '#484f58',
  green: '#238636', red: '#f85149', purple: '#6e40c9',
}

export function SkillManager({ token, somaUrl = 'https://soma.zea.cl', onSkillAssigned }: SkillManagerProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [viewingSkill, setViewingSkill] = useState<string | null>(null)
  const [skillContent, setSkillContent] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const api = `${somaUrl}/api/v1`

  const load = async () => {
    setLoading(true)
    try {
      const [sr, ar] = await Promise.all([
        fetch(`${api}/skills`, { headers }),
        fetch(`${api}/agents`, { headers }),
      ])
      if (sr.ok) setSkills((await sr.json()).data || [])
      if (ar.ok) setAgents((await ar.json()).data || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token])

  const addSkill = async () => {
    if (!newName.trim()) return
    const safeName = newName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
    await fetch(`${api}/skills`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: safeName, content: newContent }),
    })
    setNewName(''); setNewContent(''); setShowAdd(false)
    load()
  }

  const assignToAgent = async (skillName: string, agentId: string) => {
    const currentAgents = skills.find(s => s.name === skillName)?.agents || []
    await fetch(`${api}/skills/${skillName}/agents`, {
      method: 'PUT', headers,
      body: JSON.stringify({ agentIds: [...currentAgents, agentId] }),
    })
    onSkillAssigned?.()
    load()
  }

  const unassignFromAgent = async (skillName: string, agentId: string) => {
    const currentAgents = (skills.find(s => s.name === skillName)?.agents || []).filter((id: string) => id !== agentId)
    await fetch(`${api}/skills/${skillName}/agents`, {
      method: 'PUT', headers,
      body: JSON.stringify({ agentIds: currentAgents }),
    })
    load()
  }

  const viewContent = async (skillName: string) => {
    if (viewingSkill === skillName) { setViewingSkill(null); return }
    setViewingSkill(skillName)
    try {
      const res = await fetch(`${api}/skills/${skillName}`, { headers })
      if (res.ok) setSkillContent((await res.json()).data?.content || null)
    } catch { setSkillContent(null) }
  }

  const deleteSkill = async (skillName: string) => {
    await fetch(`${api}/skills/${skillName}`, { method: 'DELETE', headers })
    load()
  }

  const getAgentName = (id: string) => agents.find(a => a.id === id)?.name || id?.slice(0, 8) || '?'

  const filtered = skills.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div style={{ padding: 16, color: S.mu, fontSize: 12 }}>Loading skills...</div>
  if (error) return <div style={{ padding: 16, color: S.red, fontSize: 12 }}>{error}</div>

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${S.bc}` }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: S.mu, textTransform: 'uppercase' }}>Skills ({skills.length})</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setShowAdd(!showAdd)} style={{ background: S.green, color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>+ Add</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '4px 16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Filter skills..." style={{ width: '100%', background: S.bg, border: `1px solid ${S.bc}`, borderRadius: 4, color: S.tx, padding: '3px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="skill-name" style={inputStyle} />
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="SKILL.md content..." rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
          <button onClick={addSkill} style={{ background: S.green, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Create Skill</button>
        </div>
      )}

      {/* Skill list */}
      {filtered.map(s => (
        <div key={s.name} style={{ padding: '6px 16px', borderBottom: `1px solid ${S.bc}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => viewContent(s.name)}>
              <div style={{ fontSize: 12, color: S.tx, fontWeight: 500 }}>{s.name}</div>
              <div style={{ fontSize: 10, color: S.ha, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{s.description?.slice(0, 80)}</div>
              {/* Assigned agents */}
              {(s.agents || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                  {(s.agents || []).map((aid: string) => (
                    <span key={aid} style={{ fontSize: 9, background: `${S.pr}20`, color: S.pr, padding: '0px 5px', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      {getAgentName(aid)}
                      <button onClick={(e) => { e.stopPropagation(); unassignFromAgent(s.name, aid) }}
                        style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
              {s.custom && <span style={{ fontSize: 8, background: '#3fb95020', color: '#3fb950', padding: '1px 4px', borderRadius: 3 }}>custom</span>}
              {s.builtin && <span style={{ fontSize: 8, background: `${S.pr}20`, color: S.pr, padding: '1px 4px', borderRadius: 3 }}>builtin</span>}
              {/* Assign dropdown */}
              <select value="" onChange={(e) => { if (e.target.value) assignToAgent(s.name, e.target.value) }}
                style={{ background: S.row, border: `1px solid ${S.bc}`, borderRadius: 3, color: S.mu, fontSize: 9, fontFamily: 'inherit', padding: '1px 4px', maxWidth: 90 }}>
                <option value="">+ assign</option>
                {agents.filter((a: any) => !(s.agents || []).includes(a.id)).map((a: Agent) => (
                  <option key={a.id} value={a.id}>{(a.name || a.email || '').slice(0, 14)}</option>
                ))}
              </select>
              {s.custom && (
                <button onClick={() => deleteSkill(s.name)} style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 10, padding: 0 }}>🗑</button>
              )}
            </div>
          </div>
          {/* Skill content preview */}
          {viewingSkill === s.name && (
            <div style={{ marginTop: 6, padding: 8, background: S.bg, borderRadius: 4, border: `1px solid ${S.bc}`, fontSize: 10, color: S.tx, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {skillContent || '(sin contenido)'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: S.bg, border: `1px solid ${S.bc}`, borderRadius: 4,
  color: S.tx, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
}
