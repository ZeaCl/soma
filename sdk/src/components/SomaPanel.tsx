'use client'

import React, { useState } from 'react'

const Z = {
  bg: '#0d1117', b1: '#161b22', bc: '#21262d',
  tx: '#e6edf3', mu: '#8b949e', pr: '#58a6ff',
}

export function SomaPanel() {
  const [view, setView] = useState<'files' | 'skills'>('files')

  const navItem = (v: 'files' | 'skills', label: string, icon: string) => (
    <button
      onClick={() => setView(v)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '6px 16px', border: 'none', cursor: 'pointer',
        background: view === v ? `${Z.pr}15` : 'transparent',
        color: view === v ? Z.pr : Z.mu,
        fontSize: 13, fontFamily: 'system-ui, sans-serif', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  )

  return (
    <div>
      {navItem('files', 'Files', '📁')}
      {navItem('skills', 'Skills', '🛠️')}
    </div>
  )
}
