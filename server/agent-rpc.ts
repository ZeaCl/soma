/**
 * Agent RPC WebSocket — Multi-engine agent runtime.
 *
 * Corre en :3002. Usa EngineRegistry para rutear agentes a su motor
 * (Pi, ReAct, OpenCode, Hermes, Goose). Skills desde Thalamus,
 * system prompt dinámico, OS-level sandbox.
 *
 * Para probar: ws://soma.zea.localhost/agent-ws
 */

import { WebSocketServer, WebSocket } from 'ws'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, watch } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import {
  AuthStorage,
  ModelRegistry,
  DefaultResourceLoader,
} from '@earendil-works/pi-coding-agent'

// ── Engine Registry ──────────────────────────────────────────────────
import { EngineRegistry } from './engines/registry'
import { PiEngine } from './engines/pi-engine'
import { ReActEngine } from './engines/react-engine'
import { OpenCodeEngine } from './engines/opencode-engine'
import { HermesEngine } from './engines/hermes-engine'
import { GooseEngine } from './engines/goose-engine'
import type { AgentConfig as EngineAgentConfig, AgentSession } from './engines/types'

// Register available engines at startup
EngineRegistry.register('pi', PiEngine)
EngineRegistry.register('react', ReActEngine)
EngineRegistry.register('opencode', OpenCodeEngine)
EngineRegistry.register('hermes', HermesEngine)
EngineRegistry.register('goose', GooseEngine)

const PORT = parseInt(process.env.AGENT_RPC_PORT || '3002', 10)
const SESSION_DIR = process.env.PI_SESSION_DIR || '/app/.pi-agent-sessions'
const THALAMUS_URL = process.env.THALAMUS_URL || 'http://thalamus:4000'
const SKILLS_DIR = '/root/.agents/skills'
const SKILLS_CUSTOM_DIR = '/app/.pi-agent-skills'
let skillsVersion = 0
const AGENT_CONFIG_DIR = '/root/.agents/agent-configs'
const CONFIG_RETRY_MS = 2000
const CONFIG_MAX_RETRIES = 3

if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true })

// ── PostgreSQL (message persistence) ───────────────────────────────────────

import { Pool } from 'pg'

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres_secure_password@postgres:5432/zea_platform'
const pgPool = new Pool({ connectionString: DB_URL, max: 5 })

async function initDB() {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        last_message_at TIMESTAMPTZ DEFAULT now(),
        message_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `)
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        thinking TEXT,
        tools JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `)
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)`)
    console.log('🗄️  PostgreSQL ready — messages persisted')
  } catch (err) {
    console.warn('⚠️  PostgreSQL not available, falling back to filesystem:', (err as Error).message)
  }
}
initDB()

// ── Auth & Model ────────────────────────────────────────────────────────────

const authStorage = AuthStorage.create()
const modelRegistry = ModelRegistry.create(authStorage)

// ── Cache de config por userId ──────────────────────────────────────────────

interface AgentConfig {
  systemPrompt: string | null
  skillPaths: string[]
  resourceLoader: ReturnType<typeof DefaultResourceLoader>
  zeaToken: string
  workspacePaths: string[]
  engine?: string  // 'pi' | 'react' | 'opencode' | 'hermes' | 'goose'
}

const configCache = new Map<string, AgentConfig>()

// ── File-based fallback ─────────────────────────────────────────────────────

function loadConfigFromFile(userId: string): Partial<AgentConfig & { thalamus_user_id?: string }> | null {
  try {
    const configPath = join(AGENT_CONFIG_DIR, `${userId}.json`)
    if (!existsSync(configPath)) return null
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw)
    console.log(`📁 Config cargada desde archivo para ${userId}`)
    return {
      systemPrompt: parsed.system_prompt || null,
      workspacePaths: parsed.workspace_paths || [],
      thalamus_user_id: parsed.thalamus_user_id || undefined,
      // skills are loaded from directory, not file
      skillPaths: undefined,
    }
  } catch (err) {
    console.warn(`⚠️  Error leyendo config de archivo para ${userId}:`, (err as Error).message)
    return null
  }
}

function loadSkillsFromDir(): string[] {
  try {
    if (!existsSync(SKILLS_DIR)) return []
    return readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => join(SKILLS_DIR, d.name))
  } catch {
    return []
  }
}

async function getAgentConfig(userId: string): Promise<AgentConfig | null> {
  if (configCache.has(userId)) {
    const cached = configCache.get(userId)!
    // Refresh cache in background (don't block)
    refreshAgentConfig(userId).catch(() => {})
    return cached
  }

  // First load: retry on failure
  for (let attempt = 1; attempt <= CONFIG_MAX_RETRIES; attempt++) {
    try {
      const config = await fetchAgentConfig(userId)
      if (config) {
        configCache.set(userId, config)
        console.log(`⚙️  Config cargada para ${userId}: ${config.skillPaths.length} skills, token=${!!config.zeaToken}`)
        return config
      }
    } catch (err) {
      console.warn(`⚠️  Intento ${attempt}/${CONFIG_MAX_RETRIES} fallido para ${userId}:`, (err as Error).message)
    }
    if (attempt < CONFIG_MAX_RETRIES) {
      await new Promise(r => setTimeout(r, CONFIG_RETRY_MS * attempt))
    }
  }

  console.error(`❌ No se pudo cargar config para ${userId} después de ${CONFIG_MAX_RETRIES} intentos`)
  return null
}

async function refreshAgentConfig(userId: string) {
  const config = await fetchAgentConfig(userId)
  if (config) {
    configCache.set(userId, config)
    console.log(`🔄 Config refrescada para ${userId}`)
  }
}

async function fetchAgentConfig(userId: string): Promise<AgentConfig | null> {
  // Always load local config file first (fast, always available)
  const fileConfig = loadConfigFromFile(userId)
  const resolvedId = fileConfig?.thalamus_user_id || userId

  // Try Thalamus with resolved UUID
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`${THALAMUS_URL}/api/internal/users/${encodeURIComponent(resolvedId)}/agent-config`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      const { data: user } = await res.json()
      if (user?.is_agent) {
        const skillNames: string[] = user.agent_config?.skills || []
        const skillPaths = resolveSkillPaths(skillNames)
        const systemPrompt = user.agent_config?.system_prompt || null
        const workspacePaths = user.agent_config?.workspace_paths || []
        const engine = user.agent_config?.engine || 'pi'
        const zeaToken = await fetchZeaToken(resolvedId)
        const resourceLoader = createResourceLoader(skillPaths)
        await resourceLoader.reload()

        console.log(`☁️  Config desde Thalamus: ${skillPaths.length} skills, prompt=${!!systemPrompt}, engine=${engine}`)
        return { systemPrompt, skillPaths, resourceLoader, zeaToken, workspacePaths, engine }
      }
    }
  } catch (err) {
    console.warn(`⚠️  Thalamus no disponible para ${userId}:`, (err as Error).message)
  }

  // Fallback: use local file config (already loaded above)
  console.log(`📁 Usando config local para ${userId}...`)
  const allSkills = loadSkillsFromDir()

  if (allSkills.length > 0) {
    const resourceLoader = createResourceLoader(allSkills)
    await resourceLoader.reload()

    return {
      systemPrompt: fileConfig?.systemPrompt || buildFallbackPrompt(userId),
      skillPaths: allSkills,
      resourceLoader,
      zeaToken: '',
      workspacePaths: fileConfig?.workspacePaths || [],
      engine: 'pi',
    }
  }

  console.error(`❌ Sin skills disponibles para ${userId}`)
  return null
}

function resolveSkillPaths(names: string[]): string[] {
  const paths = names
    .map((name: string) => {
      const dir = join(SKILLS_DIR, name)
      if (existsSync(dir)) return dir
      const altDir = join(SKILLS_DIR, name.replace(/^zea-/, ''))
      if (existsSync(altDir)) return altDir
      return null
    })
    .filter(Boolean) as string[]

  // Also discover skills from custom directory (created by agent, not in Thalamus yet)
  if (existsSync(SKILLS_CUSTOM_DIR)) {
    for (const entry of readdirSync(SKILLS_CUSTOM_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const dir = join(SKILLS_CUSTOM_DIR, entry.name)
      if (existsSync(join(dir, 'SKILL.md')) && !paths.includes(dir)) {
        paths.push(dir)
        console.log(`🔍 Skill filesystem descubierta: ${entry.name}`)
      }
    }
  }

  return paths
}

function createResourceLoader(skillPaths: string[]) {
  return new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: '/app/.pi-agent',
    noSkills: false,
    skillsOverride: (base: any) => {
      const filtered = skillPaths.length > 0
        ? base.skills.filter((s: any) =>
            skillPaths.some((a: string) => s.filePath.startsWith(a) || s.baseDir?.startsWith(a))
          )
        : []
      return { ...base, skills: filtered }
    },
  })
}

async function fetchZeaToken(userId: string): Promise<string> {
  try {
    const res = await fetch(`${THALAMUS_URL}/api/internal/agent-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, scopes: ['venture:read', 'venture:write'] }),
    })
    if (res.ok) {
      const { token } = await res.json()
      if (token) process.env.ZEA_TOKEN = token
      return token || ''
    }
  } catch { /* token is optional */ }
  return ''
}

function buildFallbackPrompt(userId: string): string {
  return [
    `Eres un asistente de desarrollo (${userId}).`,
    '',
    '## Herramientas',
    '- read: leer archivos',
    '- bash: ejecutar comandos',
    '- edit: modificar archivos',
    '- write: crear nuevos archivos',
    '',
    '## Workspace',
    '- Código del proyecto en /workspace/sudlich-app',
    '- Archivos subidos por el usuario en /workspace/output/',
    '- Output generado en /workspace/output/',
  ].join('\n')
}

// ── Messages API — persistence layer ────────────────────────────────────────

interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  tools?: Array<{ name: string; input: unknown; result?: string }>
  timestamp: string
}

interface ConversationSummary {
  id: string
  title: string
  lastMessageAt: string
  messageCount: number
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.:@-]/g, '_')
}

function messagesPath(conversationId: string): string {
  const dir = join(MSG_DIR, sanitizeFileName(conversationId))
  return join(dir, 'messages.json')
}

export async function getMessages(conversationId: string): Promise<StoredMessage[]> {
  try {
    const { rows } = await pgPool.query(
      `SELECT id, role, content, thinking, tools, created_at as timestamp
       FROM messages WHERE conversation_id = $1 ORDER BY created_at`,
      [conversationId]
    )
    return rows.map((r: any) => ({ ...r, timestamp: r.timestamp?.toISOString?.() || r.timestamp }))
  } catch { return [] }
}

export async function addMessage(conversationId: string, msg: Omit<StoredMessage, 'id' | 'timestamp'>): Promise<StoredMessage | null> {
  try {
    // Strip dm: prefix for UUID column compatibility
    const cleanId = conversationId.startsWith('dm:') ? conversationId.slice(3) : conversationId
    // Ensure conversation exists
    await pgPool.query(
      `INSERT INTO conversations (id, organization_id, user_id, agent_id, app_context, title, last_message_at, message_count)
       VALUES ($1, $2, $3, $4, $5, $6, now(), 1)
       ON CONFLICT (id) DO UPDATE SET last_message_at = now(), message_count = conversations.message_count + 1`,
      [cleanId, '00000000-0000-0000-0000-000000000000', 'system', cleanId, 'chat', msg.content?.slice(0, 80) || '']
    )
    // Insert message
    const { rows } = await pgPool.query(
      `INSERT INTO messages (conversation_id, role, content, thinking, tools)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [cleanId, msg.role, msg.content, msg.thinking || null, msg.tools ? JSON.stringify(msg.tools) : null]
    )
    return {
      id: rows[0].id,
      ...msg,
      timestamp: rows[0].created_at?.toISOString?.() || new Date().toISOString(),
    }
  } catch (err) {
    console.warn('⚠️  DB addMessage failed:', (err as Error).message)
    return null
  }
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  try {
    const { rows } = await pgPool.query(
      `SELECT id, title, last_message_at, message_count
       FROM conversations WHERE user_id = 'system' OR id LIKE 'dm:%'
       ORDER BY last_message_at DESC LIMIT 50`
    )
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title || 'Nueva conversación',
      lastMessageAt: r.last_message_at?.toISOString?.() || new Date().toISOString(),
      messageCount: parseInt(r.message_count) || 0,
    }))
  } catch { return [] }
}

// ── Auth helper ─────────────────────────────────────────────────────────────

async function syncSkillToThalamus(agentId: string, skillName: string, action: 'add' | 'remove') {
  try {
    const res = await fetch(`${THALAMUS_URL}/api/internal/users/${encodeURIComponent(agentId)}/agent-config`)
    if (!res.ok) return
    const { data: user } = await res.json()
    const currentSkills: string[] = user?.agent_config?.skills || []
    const newSkills = action === 'add'
      ? [...new Set([...currentSkills, skillName])]
      : currentSkills.filter((s: string) => s !== skillName)

    await fetch(`${THALAMUS_URL}/api/users/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_config: { skills: newSkills } }),
    })
  } catch (err) {
    console.warn(`⚠️  Thalamus sync failed for skill ${skillName} (${action}):`, (err as Error).message)
  }
}

function extractUserIdFromJwt(req: IncomingMessage): string | null {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  try {
    const payloadBase64 = token.split('.')[1]
    if (!payloadBase64) return null
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())
    return (payload.sub || '').replace(/^user_/, '') || null
  } catch { return null }
}

// ── HTTP + WebSocket ────────────────────────────────────────────────────────

const MSG_DIR = '/app/.pi-agent-messages'
if (!existsSync(MSG_DIR)) mkdirSync(MSG_DIR, { recursive: true })

async function readRequestBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(body)) }
      catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(data))
}

// ── Skills registry (module scope — shared by HTTP + watcher) ──────────────

function getSkillAgents(skillName: string): string[] {
  const regPath = join(SKILLS_CUSTOM_DIR, '.registry.json')
  try {
    if (existsSync(regPath)) {
      const reg = JSON.parse(readFileSync(regPath, 'utf-8'))
      return reg[skillName] || []
    }
  } catch { /* ignore */ }
  return []
}

function saveSkillAgents(skillName: string, agentIds: string[]) {
  const regPath = join(SKILLS_CUSTOM_DIR, '.registry.json')
  if (!existsSync(SKILLS_CUSTOM_DIR)) mkdirSync(SKILLS_CUSTOM_DIR, { recursive: true })
  let reg: Record<string, string[]> = {}
  try {
    if (existsSync(regPath)) reg = JSON.parse(readFileSync(regPath, 'utf-8'))
  } catch { /* ignore */ }
  reg[skillName] = agentIds.filter(Boolean)
  writeFileSync(regPath, JSON.stringify(reg, null, 2))
}

function listAllSkills(): Array<{ name: string; description: string; agents: string[]; custom: boolean }> {
  const skills: Array<{ name: string; description: string; agents: string[]; custom: boolean }> = []
  function scanDir(dir: string, custom: boolean) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const mdPath = join(dir, entry.name, 'SKILL.md')
      if (!existsSync(mdPath)) continue
      if (skills.some(s => s.name === entry.name)) continue
      const content = readFileSync(mdPath, 'utf-8')
      const descMatch = content.match(/description:\s*(.+)/i)
      const description = descMatch?.[1]?.trim() || content.split('\n').find(l => l && !l.startsWith('#') && !l.startsWith('---'))?.slice(0, 120) || ''
      skills.push({ name: entry.name, description, agents: getSkillAgents(entry.name), custom })
    }
  }
  scanDir(SKILLS_DIR, false)
  scanDir(SKILLS_CUSTOM_DIR, true)
  return skills
}

function findSkillPath(name: string): string | null {
  const customPath = join(SKILLS_CUSTOM_DIR, name, 'SKILL.md')
  if (existsSync(customPath)) return customPath
  const builtinPath = join(SKILLS_DIR, name, 'SKILL.md')
  if (existsSync(builtinPath)) return builtinPath
  return null
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    })
    res.end()
    return
  }

  const url = req.url || '/'

  // GET /api/conversations
  if (url === '/api/conversations' && req.method === 'GET') {
    const userId = extractUserIdFromJwt(req)
    if (!userId) { sendJson(res, 401, { error: 'Unauthorized' }); return }
    try {
      const conversations = await listConversations(userId)
      sendJson(res, 200, { conversations })
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return
  }

  // GET /api/conversations/:id
  const getMatch = url.match(/^\/api\/conversations\/(.+)$/)
  if (getMatch && req.method === 'GET') {
    const userId = extractUserIdFromJwt(req)
    if (!userId) { sendJson(res, 401, { error: 'Unauthorized' }); return }
    const convId = decodeURIComponent(getMatch[1])
    try {
      const messages = await getMessages(convId)
      sendJson(res, 200, { id: convId, messages })
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return
  }

  // POST /api/conversations/:id/messages
  const postMatch = url.match(/^\/api\/conversations\/(.+)\/messages$/)
  if (postMatch && req.method === 'POST') {
    const userId = extractUserIdFromJwt(req)
    if (!userId) { sendJson(res, 401, { error: 'Unauthorized' }); return }
    const convId = decodeURIComponent(postMatch[1])
    try {
      const body = await readRequestBody(req)
      if (!body.role || !body.content) {
        sendJson(res, 400, { error: 'Missing role or content' })
        return
      }
      const msg = await addMessage(convId, {
        role: body.role,
        content: body.content,
        thinking: body.thinking,
        tools: body.tools,
      })
      sendJson(res, 201, msg)
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return
  }

  // ── Skills API ──────────────────────────────────────────────────────────

  // GET /api/skills
  if (url === '/api/skills' && req.method === 'GET') {
    try {
      const skills = listAllSkills()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ skills }))
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // GET /api/skills/:name
  const skillGetMatch = url.match(/^\/api\/skills\/([^\/]+)$/)
  if (skillGetMatch && req.method === 'GET') {
    const name = decodeURIComponent(skillGetMatch[1])
    const mdPath = findSkillPath(name)
    if (!mdPath) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Skill not found' }))
      return
    }
    try {
      const content = readFileSync(mdPath, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ name, content, agents: getSkillAgents(name) }))
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // POST /api/skills
  if (url === '/api/skills' && req.method === 'POST') {
    const body = await readRequestBody(req)
    const { name, content, agentId } = body
    if (!name || !content) { sendJson(res, 400, { error: 'Missing name or content' }); return }
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
    if (safeName !== name) { sendJson(res, 400, { error: 'Invalid skill name' }); return }
    if (findSkillPath(safeName)) { sendJson(res, 409, { error: 'Skill already exists' }); return }
    const skillDir = join(SKILLS_CUSTOM_DIR, safeName)
    try {
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, 'SKILL.md'), content)
      const agents = agentId ? [agentId] : []
      saveSkillAgents(safeName, agents)
      if (agentId) syncSkillToThalamus(agentId, safeName, 'add').catch(() => {})
      skillsVersion++
      sendJson(res, 201, { name: safeName, path: skillDir, assignedTo: agents })
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return
  }

  // PUT /api/skills/:name
  const skillPutMatch = url.match(/^\/api\/skills\/([^\/]+)$/)
  if (skillPutMatch && req.method === 'PUT') {
    const name = decodeURIComponent(skillPutMatch[1])
    const body = await readRequestBody(req)
    const mdPath = join(SKILLS_CUSTOM_DIR, name, 'SKILL.md')
    if (!existsSync(mdPath)) { sendJson(res, 404, { error: 'Skill not found or not editable (built-in skills are read-only)' }); return }
    try {
      writeFileSync(mdPath, body.content || '')
      sendJson(res, 200, { name, updated: true })
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return
  }

  // DELETE /api/skills/:name
  const skillDelMatch = url.match(/^\/api\/skills\/([^\/]+)$/)
  if (skillDelMatch && req.method === 'DELETE') {
    const name = decodeURIComponent(skillDelMatch[1])
    const skillDir = join(SKILLS_CUSTOM_DIR, name)
    if (!existsSync(skillDir)) { sendJson(res, 404, { error: 'Skill not found or not deletable' }); return }
    try {
      const agents = getSkillAgents(name)
      for (const aId of agents) {
        await syncSkillToThalamus(aId, name, 'remove').catch(() => {})
      }
      rmSync(skillDir, { recursive: true, force: true })
      saveSkillAgents(name, [])
      sendJson(res, 204, {})
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return
  }

  // PUT /api/skills/:name/agents
  const skillAgentsMatch = url.match(/^\/api\/skills\/([^\/]+)\/agents$/)
  if (skillAgentsMatch && req.method === 'PUT') {
    const name = decodeURIComponent(skillAgentsMatch[1])
    const body = await readRequestBody(req)
    if (!Array.isArray(body.agentIds)) { sendJson(res, 400, { error: 'agentIds must be an array' }); return }
    saveSkillAgents(name, body.agentIds)
    for (const aId of body.agentIds) {
      await syncSkillToThalamus(aId, name, 'add').catch(() => {})
    }
    sendJson(res, 200, { name, assignedTo: body.agentIds })
    return
  }

  // DELETE /api/conversations/:id
  const delMatch = url.match(/^\/api\/conversations\/(.+)$/)
  if (delMatch && req.method === 'DELETE') {
    const userId = extractUserIdFromJwt(req)
    if (!userId) { sendJson(res, 401, { error: 'Unauthorized' }); return }
    const convId = decodeURIComponent(delMatch[1])
    try {
      await pgPool.query('DELETE FROM messages WHERE conversation_id = $1', [convId])
      await pgPool.query('DELETE FROM conversations WHERE id = $1', [convId])
      sendJson(res, 200, { deleted: true })
    } catch (err: any) {
      sendJson(res, 500, { error: err.message })
    }
    return
  }

  // ── Previews API ──────────────────────────────────────────────────────

  if (url === '/api/previews' && req.method === 'GET') {
    try {
      // Forward to Preview Manager service
      const pmRes = await fetch('http://preview-manager:3009/api/previews')
      if (pmRes.ok) {
        const data = await pmRes.json()
        sendJson(res, 200, data)
      } else {
        throw new Error('Preview Manager returned non-200')
      }
    } catch {
      // Fallback: return empty (Preview Manager not deployed yet)
      sendJson(res, 200, { previews: [], count: 0 })
    }
    return
  }

  // Health check fallback
  res.writeHead(200)
  res.end('Agent RPC OK')
})

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws: WebSocket) => {
  console.log('📡 RPC client connected')

  let userId = ''
  let conversationId = ''
  let session: AgentSession | null = null
  let assistantContent = ''
  let assistantThinking = ''
  let promptAborted = false
  const assistantTools: Array<{ name: string; input: unknown; result?: string }> = []

  ws.on('message', async (raw) => {
    let json: any
    try {
      json = JSON.parse(raw.toString())
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
      return
    }

    const { type, text, uid, cid } = json

    // Init: load agent config → resolve engine → create session
    if (type === 'init') {
      userId = uid || ''
      conversationId = cid || ''
      activeAgentId = userId
      assistantContent = ''
      assistantThinking = ''
      assistantTools.length = 0
      promptAborted = false

      const configChanged = skillsVersion > 0
      if (configChanged) configCache.delete(userId)
      const config = await getAgentConfig(userId)
      console.log(`🔧 Init: user=${userId} conv=${conversationId} config=${!!config}`)

      if (!config) {
        ws.send(JSON.stringify({ type: 'error', message: 'Agent config not found' }))
        return
      }

      if (config.zeaToken) process.env.ZEA_TOKEN = config.zeaToken

      // Resolve engine
      const engineName = config.engine || 'pi'
      const engine = EngineRegistry.get(engineName)
      if (!engine) {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown engine: ${engineName}` }))
        console.error(`❌ Unknown engine: ${engineName}`)
        return
      }

      console.log(`🔧 Init: user=${userId} engine=${engineName} conv=${conversationId}`)

      const sessionKey = conversationId || userId || 'rpc-default'
      const dir = join(SESSION_DIR, sessionKey)

      if (configChanged && existsSync(dir)) {
        try { rmSync(dir, { recursive: true, force: true }) } catch {}
      }
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

      try {
        session = await engine.createSession({
          systemPrompt: config.systemPrompt,
          skillPaths: config.skillPaths,
          tools: config.tools || ['read', 'bash', 'edit', 'write'],
          workspacePaths: config.workspacePaths,
          sessionDir: dir,
          modelRegistry,
          authStorage,
          ...(config.resourceLoader ? { resourceLoader: config.resourceLoader } : {}),
        })
        console.log(`✅ Sesión lista (${engineName})`)

        // Subscribe — unified StreamEvent format
        session.subscribe((event) => {
          switch (event.type) {
            case 'thinking_start':
              ws.send(JSON.stringify({ type: 'thinking_start' }))
              break
            case 'thinking':
              assistantThinking += event.text
              ws.send(JSON.stringify({ type: 'thinking', text: event.text }))
              break
            case 'thinking_end':
              ws.send(JSON.stringify({ type: 'thinking_end' }))
              break
            case 'delta':
              assistantContent += event.text
              ws.send(JSON.stringify({ type: 'delta', text: event.text }))
              break
            case 'tool_use':
              assistantTools.push({ name: event.name, input: event.input })
              ws.send(JSON.stringify({ type: 'tool', name: event.name, input: event.input }))
              break
            case 'tool_result':
              const lastTool = assistantTools[assistantTools.length - 1]
              if (lastTool) lastTool.result = event.content
              ws.send(JSON.stringify({ type: 'tool_result', content: event.content }))
              break
            case 'error':
              ws.send(JSON.stringify({ type: 'error', message: event.message }))
              break
            // 'done' is handled after prompt resolves
          }
        })

        ws.send(JSON.stringify({ type: 'ready' }))
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', message: `Session init failed (${engineName}): ${err.message}` }))
      }
      return
    }

    // Cancel
    if (type === 'cancel' && session) {
      console.log(`⏹️  Cancel requested for conv ${conversationId.slice(0, 8)}`)
      promptAborted = true
      try {
        await session.abort()
        ws.send(JSON.stringify({ type: 'cancelled' }))
        // Reset accumulators since the response was aborted
        assistantContent = ''
        assistantThinking = ''
        assistantTools.length = 0
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', message: 'Cancel failed: ' + err.message }))
      }
      return
    }

    // Prompt
    if (type === 'prompt' && session) {
      if (!text?.trim()) return
      console.log(`💬 Prompt [${conversationId.slice(0, 8)}]: "${text.slice(0, 60)}..."`)

      // Persist user message
      try {
        addMessage(conversationId, { role: 'user', content: text })
      } catch (err: any) {
        console.warn(`⚠️  Failed to persist user message: ${err.message}`)
      }

      try {
        await session.prompt(text)
        if (promptAborted) return // session was aborted via cancel; don't send done/persist
        ws.send(JSON.stringify({ type: 'done' }))

        // Persist assistant response
        try {
          const content = assistantContent.trim()
          if (content || assistantTools.length > 0) {
            addMessage(conversationId, {
              role: 'assistant',
              content: content || '(sin respuesta)',
              thinking: assistantThinking.trim() || undefined,
              tools: assistantTools.length > 0 ? assistantTools : undefined,
            })
          }
        } catch (err: any) {
          console.warn(`⚠️  Failed to persist assistant message: ${err.message}`)
        }

        // Reset accumulators for next prompt
        assistantContent = ''
        assistantThinking = ''
        assistantTools.length = 0
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', message: String(err) }))
      }
      return
    }

    ws.send(JSON.stringify({ type: 'error', message: 'Unknown command or not initialized' }))
  })

  ws.on('close', () => {
    console.log('📡 RPC client disconnected')
    session = null
  })
})

httpServer.listen(PORT, () => {
  console.log(`🚀 Agent RPC WebSocket on ws://0.0.0.0:${PORT}`)
})

// ── Skills auto-discovery watcher ──────────────────────────────────────────

if (!existsSync(SKILLS_CUSTOM_DIR)) {
  mkdirSync(SKILLS_CUSTOM_DIR, { recursive: true })
}

// Track which skills were already known to avoid re-registering
const knownSkills = new Set<string>()
// Track the most recent agent connected (for auto-registration)
let activeAgentId = ''
// Initialize from existing custom skills
if (existsSync(SKILLS_CUSTOM_DIR)) {
  for (const entry of readdirSync(SKILLS_CUSTOM_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      knownSkills.add(entry.name)
    }
  }
}

// Watch custom skills directory for new SKILL.md files
try {
  watch(SKILLS_CUSTOM_DIR, { recursive: false }, (_eventType, filename) => {
    if (!filename || filename === '.registry.json') return
    // Check if it's a new directory with SKILL.md
    const skillDir = join(SKILLS_CUSTOM_DIR, filename)
    const mdPath = join(skillDir, 'SKILL.md')
    if (existsSync(mdPath) && !knownSkills.has(filename)) {
      knownSkills.add(filename)
      console.log(`🆕 Nueva skill detectada: ${filename}`)
      // Auto-register for the active agent
      if (activeAgentId && filename) {
        const skillContent = readFileSync(mdPath, 'utf-8')
        saveSkillAgents(filename, [activeAgentId])
        syncSkillToThalamus(activeAgentId, filename, 'add').then(() => {
          console.log(`✅ Skill ${filename} auto-registrada para agente ${activeAgentId}`)
          skillsVersion++
        }).catch((err) => {
          console.warn(`⚠️  Auto-registro fallido para ${filename}:`, err.message)
        })
      }
    }
  })
} catch (err) {
  console.warn('⚠️  Skills watcher not available:', (err as Error).message)
}
