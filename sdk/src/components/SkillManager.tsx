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
}

export function SkillManager({ token, somaUrl = 'http://soma.zea.localhost', onSkillAssigned }: SkillManagerProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [assignTarget, setAssignTarget] = useState<string | null>(null)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const load = async () => {
    setLoading(true)
    try {
      const [sr, ar] = await Promise.all([
        fetch(`${somaUrl}/api/skills`, { headers }),
        fetch(`${somaUrl}/api/agents`, { headers }),
      ])
      if (!sr.ok) throw new Error('skills: ' + sr.status)
      if (!ar.ok) throw new Error('agents: ' + ar.status)
      const sd = await sr.json()
      const ad = await ar.json()
      setSkills(sd.data || [])
      setAgents(ad.data || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const addSkill = async () => {
    if (!newName.trim()) return
    await fetch(`${somaUrl}/api/skills`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: newName, content: newContent }),
    })
    setNewName('')
    setNewContent('')
    setShowAdd(false)
    load()
  }

  const assignToAgent = async (skillName: string, agentId: string) => {
    await fetch(`${somaUrl}/api/skills/${skillName}/agents`, {
      method: 'PUT', headers,
      body: JSON.stringify({ agentIds: [agentId] }),
    })
    onSkillAssigned?.()
  }

  const Z = { mu: '#8b949e', pr: '#58a6ff', tx: '#e6edf3', ha: '#484f58', b1: '#161b22', bc: '#21262d' }

  if (loading) return <div style={{ padding: 16, color: Z.mu, fontSize: 12 }}>Loading skills...</div>
  if (error) return <div style={{ padding: 16, color: '#f85149', fontSize: 12 }}>{error}</div>

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: Z.mu, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skills</span>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: Z.pr, color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>+ Add</button>
      </div>

      {showAdd && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Skill name" style={{ background: '#0d1117', border: `1px solid ${Z.bc}`, borderRadius: 4, color: Z.tx, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Skill description (optional)" rows={2} style={{ background: '#0d1117', border: `1px solid ${Z.bc}`, borderRadius: 4, color: Z.tx, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
          <button onClick={addSkill} style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Create Skill</button>
        </div>
      )}

      {skills.map(s => (
        <div key={s.name} style={{ padding: '4px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: Z.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
              <div style={{ fontSize: 10, color: Z.ha, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {s.custom && <span style={{ fontSize: 8, color: '#3fb950', background: '#3fb95020', padding: '1px 4px', borderRadius: 3 }}>custom</span>}
              <select
                value=""
                onChange={(e) => { if (e.target.value) assignToAgent(s.name, e.target.value) }}
                style={{ background: Z.b1, border: `1px solid ${Z.bc}`, borderRadius: 3, color: Z.mu, fontSize: 9, fontFamily: 'inherit', padding: '1px 4px', maxWidth: 80 }}
              >
                <option value="">assign</option>
                {agents.map((a: any) => (
                  <option key={a.id} value={a.id}>{(a.name || '').slice(0, 12)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
