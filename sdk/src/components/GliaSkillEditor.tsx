'use client'

import React from 'react'
import type { GliaSkill } from '../types'

interface GliaSkillEditorProps {
  skills: GliaSkill[]
  loading?: boolean
  onCreate?: (name: string, content: string) => Promise<boolean>
  onDelete?: (name: string) => Promise<void>
}

export function GliaSkillEditor({ skills, loading, onCreate, onDelete }: GliaSkillEditorProps) {
  if (loading) return <div className="p-4 text-sm text-gray-400">Cargando...</div>

  return (
    <div className="flex flex-col gap-1 p-2">
      {skills.map(skill => (
        <div key={skill.name} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50">
          <span className="text-xs">{skill.custom ? '🟢' : '  '}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{skill.name}</div>
            <div className="text-xs text-gray-400 truncate">{skill.description}</div>
          </div>
          {skill.custom && (
            <button onClick={() => onDelete?.(skill.name)}
              className="text-xs text-red-500 hover:text-red-700">×</button>
          )}
        </div>
      ))}
    </div>
  )
}
