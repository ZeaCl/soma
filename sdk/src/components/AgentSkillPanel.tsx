'use client'

import React, { useState, useEffect } from 'react'

export interface AgentSkillPanelProps {
  agentId: string
  token: string
  somaUrl?: string
  onRefresh?: () => void
}

interface Skill {
  name: string
  description: string
  custom: boolean
  builtin: boolean
  agents?: string[]
}

const S = {
  bg: '#0d1117', row: '#161b22', bc: '#21262d',
  tx: '#e6edf3', mu: '#8b949e', pr: '#58a6ff', ha: '#484f58',
  green: '#238636', red: '#f85149', purple: '#6e40c9',
}

export function AgentSkillPanel({ agentId, token, somaUrl = 'https://soma.zea.cl', onRefresh }: AgentSkillPanelProps) {
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingSkill, setViewingSkill] = useState<string | null>(null)
  const [skillContent, setSkillContent] = useState<string | null>(null)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const api = `${somaUrl}/api/v1`

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${api}/skills`, { headers })
      if (res.ok) setAllSkills((await res.json()).data || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token, agentId])

  const assignedSkills = allSkills.filter(s => (s.agents || []).includes(agentId))
  const availableSkills = allSkills.filter(s => !(s.agents || []).includes(agentId))

  const assign = async (skillName: string) => {
    const currentAgents = allSkills.find(s => s.name === skillName)?.agents || []
    await fetch(`${api}/skills/${skillName}/agents`, {
      method: 'PUT', headers,
      body: JSON.stringify({ agentIds: [...currentAgents, agentId] }),
    })
    onRefresh?.()
    load()
  }

  const unassign = async (skillName: string) => {
    const currentAgents = (allSkills.find(s => s.name === skillName)?.agents || []).filter((id: string) => id !== agentId)
    await fetch(`${api}/skills/${skillName}/agents`, {
      method: 'PUT', headers,
      body: JSON.stringify({ agentIds: currentAgents }),
    })
    onRefresh?.()
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

  if (loading) return <div style={{ padding: 16, color: S.mu, fontSize: 13 }}>Loading skills...</div>
  if (error) return <div style={{ padding: 16, color: S.red, fontSize: 13 }}>{error}</div>

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', fontSize: 13, height: '100%', overflow: 'auto' }}>
      {/* Assigned skills */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: S.tx, marginBottom: 8 }}>📋 Skills asignadas ({assignedSkills.length})</h3>
      {assignedSkills.length === 0 && <div style={{ color: S.mu, marginBottom: 16 }}>No hay skills asignadas a este agente.</div>}
      {assignedSkills.map(s => (
        <div key={s.name} style={{ padding: '8px 12px', marginBottom: 6, background: S.row, borderRadius: 6, border: `1px solid ${S.bc}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => viewContent(s.name)}>
              <div style={{ color: S.tx, fontWeight: 500 }}>{s.name}</div>
              <div style={{ color: S.ha, fontSize: 11, marginTop: 2 }}>{s.description?.slice(0, 100)}</div>
            </div>
            <button onClick={() => unassign(s.name)} style={{
              background: S.red, color: '#fff', border: 'none', borderRadius: 4,
              padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', flexShrink: 0,
            }}>✕ Desinstalar</button>
          </div>
          {viewingSkill === s.name && (
            <div style={{ marginTop: 8, padding: 8, background: S.bg, borderRadius: 4, fontSize: 10, color: S.tx, maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {skillContent || '(sin contenido)'}
            </div>
          )}
        </div>
      ))}

      {/* Available skills */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: S.tx, marginBottom: 8, marginTop: 20 }}>📦 Skills disponibles ({availableSkills.length})</h3>
      {availableSkills.length === 0 && <div style={{ color: S.mu }}>Todas las skills están asignadas.</div>}
      {availableSkills.map(s => (
        <div key={s.name} style={{ padding: '8px 12px', marginBottom: 6, background: S.row, borderRadius: 6, border: `1px dashed ${S.bc}`, opacity: 0.7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => viewContent(s.name)}>
              <div style={{ color: S.tx, fontWeight: 500 }}>{s.name}</div>
              <div style={{ color: S.ha, fontSize: 11, marginTop: 2 }}>{s.description?.slice(0, 100)}</div>
            </div>
            <button onClick={() => assign(s.name)} style={{
              background: S.green, color: '#fff', border: 'none', borderRadius: 4,
              padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', flexShrink: 0,
            }}>+ Instalar</button>
          </div>
          {viewingSkill === s.name && (
            <div style={{ marginTop: 8, padding: 8, background: S.bg, borderRadius: 4, fontSize: 10, color: S.tx, maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {skillContent || '(sin contenido)'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
