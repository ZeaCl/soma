/**
 * MemorySandboxProvider — in-memory file storage for tests and demos.
 */

import type { SandboxProvider, SandboxFile } from './types'

export function createMemorySandboxProvider(): SandboxProvider {
  const files = new Map<string, string>()

  function normPath(p: string): string {
    return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  }

  return {
    async listFiles(p: string): Promise<SandboxFile[]> {
      const base = normPath(p)
      const seen = new Set<string>()
      const result: SandboxFile[] = []

      for (const [fp, content] of files) {
        if (!fp.startsWith(base === '/' ? '' : base)) continue
        const relative = fp.slice(base === '/' ? 1 : base.length + 1)
        const parts = relative.split('/')
        const name = parts[0]

        if (seen.has(name)) continue
        seen.add(name)

        if (parts.length === 1) {
          result.push({ name, type: 'file', size: content.length })
        } else {
          result.push({ name, type: 'dir', size: 0 })
        }
      }

      return result
    },

    async readFile(p: string): Promise<string> {
      const key = normPath(p)
      const content = files.get(key)
      if (content === undefined) throw new Error(`File not found: ${p}`)
      return content
    },

    async writeFile(p: string, content: string): Promise<void> {
      files.set(normPath(p), content)
    },

    async deleteFile(p: string): Promise<void> {
      files.delete(normPath(p))
    },

    async mkdir(_p: string): Promise<void> {
      // Directories are implicit in memory storage
    },
  }
}
