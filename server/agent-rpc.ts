/**
 * Agent RPC WebSocket + HTTP — orquestador multi-agente con aislamiento real.
 *
 * Corre en :3002. Cada agente corre como subproceso `pi --mode rpc`
 * bajo su propio usuario Linux (creado vía agent-sandbox.ts).
 * Skills, workspace y sesiones aisladas por filesystem (permisos UNIX).
 *
 * Para probar: ws://soma.zea.localhost/agent-ws
 */

import { WebSocketServer, WebSocket } from 'ws'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, watch } from 'fs'
import { join } from 'path'

// ── Sandbox + RPC Bridge ──────────────────────────────────────────────────
import { prepareAgent, destroyAgent, sandboxExists, sandboxUsername, agentHome } from './agent-sandbox'
import { RpcBridge } from './rpc-bridge'

const PORT = parseInt(process.env.AGENT_RPC_PORT || '3002', 10)
const THALAMUS_URL = process.env.THALAMUS_URL || 'http://thalamus:4000'
const SKILLS_DIR = '/root/.agents/skills'
const SKILLS_CUSTOM_DIR = '/app/.pi-agent-skills'
let skillsVersion = 0

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
    const cleanId = conversationId.startsWith('dm:') ? conversationId.slice(3) : conversationId
    await pgPool.query(
      `INSERT INTO conversations (id, organization_id, user_id, agent_id, app_context, title, last_message_at, message_count)
       VALUES ($1, $2, $3, $4, $5, $6, now(), 1)
       ON CONFLICT (id) DO UPDATE SET last_message_at = now(), message_count = conversations.message_count + 1`,
      [cleanId, '00000000-0000-0000-0000-000000000000', 'system', cleanId, 'chat', msg.content?.slice(0, 80) || '']
    )
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

// ── Agent config (local-first, no depende de Thalamus en runtime) ────────
//
// Arquitectura correcta:
//   Thalamus → POST /api/agents → Soma guarda config en sandbox
//   Runtime: Soma lee config del filesystem del agente, NO de Thalamus
//
// Esto elimina la dependencia circular y el bug del endpoint 400.

interface AgentConfig {
  systemPrompt: string | null
  skills: string[]
  engine?: string
}

/**
 * Obtiene la config del agente desde su sandbox local.
 * No depende de Thalamus en runtime — las skills ya fueron copiadas
 * por agent-sandbox.ts durante prepareAgent().
 *
 * Si Thalamus quiere actualizar la config de un agente, debe llamar
 * a POST /api/agents (endpoint receiver abajo).
 */
function fetchAgentSkills(agentId: string): AgentConfig {
  const home = agentHome(agentId)

  // 1. Leer system_prompt de config local
  let systemPrompt: string | null = null
  const configPath = join(home, '.pi', 'agent', 'config.json')
  try {
    if (existsSync(configPath)) {
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'))
      systemPrompt = cfg.system_prompt || null
    }
  } catch { /* ignore */ }

  // 2. Listar skills del home del agente
  let skills = listAgentSkills(home)

  // 3. Si no hay skills en el home, usar TODAS las disponibles en /root/.agents/skills/
  if (skills.length === 0) {
    skills = listAgentSkills('/root')
  }

  if (skills.length > 0) {
    console.log(`🔧 Agent ${agentId.slice(0, 12)}: ${skills.length} skills locales, system_prompt=${systemPrompt ? 'sí' : 'no'}`)
  }

  return { systemPrompt, skills, engine: 'pi' }
}

/** Lista skills instaladas en el home del agente */
function listAgentSkills(home: string): string[] {
  const names: string[] = []
  const skillsDir = join(home, '.agents', 'skills')
  if (!existsSync(skillsDir)) return names
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && existsSync(join(skillsDir, entry.name, 'SKILL.md'))) {
      names.push(entry.name)
    }
  }
  return names
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  })
  res.end(JSON.stringify(data))
}

// ── Skills registry ────────────────────────────────────────────────────────

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
  if (!existsSync(SKILLS_CUSTOM_DIR)) mkdirSync(SKILLS_CUSTOM_DIR, { recursive: true })
  let reg: Record<string, string[]> = {}
  const regPath = join(SKILLS_CUSTOM_DIR, '.registry.json')
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

// ── HTTP Server ─────────────────────────────────────────────────────────────

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    } catch (err: any) { sendJson(res, 500, { error: err.message }) }
    return
  }

  // GET /api/conversations/:id
  const getMatch = url.match(/^\/api\/conversations\/(.+)$/)
  if (getMatch && req.method === 'GET') {
    const userId = extractUserIdFromJwt(req)
    if (!userId) { sendJson(res, 401, { error: 'Unauthorized' }); return }
    try {
      const messages = await getMessages(decodeURIComponent(getMatch[1]))
      sendJson(res, 200, { id: decodeURIComponent(getMatch[1]), messages })
    } catch (err: any) { sendJson(res, 500, { error: err.message }) }
    return
  }

  // DELETE /api/conversations/:id
  if (getMatch && req.method === 'DELETE') {
    const userId = extractUserIdFromJwt(req)
    if (!userId) { sendJson(res, 401, { error: 'Unauthorized' }); return }
    try {
      const convId = decodeURIComponent(getMatch[1])
      await pgPool.query('DELETE FROM messages WHERE conversation_id = $1', [convId])
      await pgPool.query('DELETE FROM conversations WHERE id = $1', [convId])
      sendJson(res, 200, { deleted: true })
    } catch (err: any) { sendJson(res, 500, { error: err.message }) }
    return
  }

  // POST /api/conversations/:id/messages
  const postMatch = url.match(/^\/api\/conversations\/(.+)\/messages$/)
  if (postMatch && req.method === 'POST') {
    const userId = extractUserIdFromJwt(req)
    if (!userId) { sendJson(res, 401, { error: 'Unauthorized' }); return }
    try {
      const body = await readRequestBody(req)
      if (!body.role || !body.content) { sendJson(res, 400, { error: 'Missing role or content' }); return }
      const msg = await addMessage(decodeURIComponent(postMatch[1]), { role: body.role, content: body.content, thinking: body.thinking, tools: body.tools })
      sendJson(res, 201, msg)
    } catch (err: any) { sendJson(res, 500, { error: err.message }) }
    return
  }

  // ── Skills API ──────────────────────────────────────────────────────────

  if (url === '/api/skills' && req.method === 'GET') {
    try {
      sendJson(res, 200, { skills: listAllSkills() })
    } catch (err: any) { sendJson(res, 500, { error: err.message }) }
    return
  }

  const skillGetMatch = url.match(/^\/api\/skills\/([^\/]+)$/)
  if (skillGetMatch && req.method === 'GET') {
    const name = decodeURIComponent(skillGetMatch[1])
    const mdPath = findSkillPath(name)
    if (!mdPath) { sendJson(res, 404, { error: 'Skill not found' }); return }
    try {
      sendJson(res, 200, { name, content: readFileSync(mdPath, 'utf-8'), agents: getSkillAgents(name) })
    } catch (err: any) { sendJson(res, 500, { error: err.message }) }
    return
  }

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
      saveSkillAgents(safeName, agentId ? [agentId] : [])
      skillsVersion++
      sendJson(res, 201, { name: safeName, path: skillDir, assignedTo: agentId ? [agentId] : [] })
    } catch (err: any) { sendJson(res, 500, { error: err.message }) }
    return
  }

  if (skillGetMatch && req.method === 'PUT') {
    const name = decodeURIComponent(skillGetMatch[1])
    const body = await readRequestBody(req)
    const mdPath = join(SKILLS_CUSTOM_DIR, name, 'SKILL.md')
    if (!existsSync(mdPath)) { sendJson(res, 404, { error: 'Skill not found or not editable' }); return }
    try {
      writeFileSync(mdPath, body.content || '')
      sendJson(res, 200, { name, updated: true })
    } catch (err: any) { sendJson(res, 500, { error: err.message }) }
    return
  }

  if (skillGetMatch && req.method === 'DELETE') {
    const name = decodeURIComponent(skillGetMatch[1])
    const skillDir = join(SKILLS_CUSTOM_DIR, name)
    if (!existsSync(skillDir)) { sendJson(res, 404, { error: 'Skill not found' }); return }
    try {
      rmSync(skillDir, { recursive: true, force: true })
      saveSkillAgents(name, [])
      sendJson(res, 204, {})
    } catch (err: any) { sendJson(res, 500, { error: err.message }) }
    return
  }

  const skillAgentsMatch = url.match(/^\/api\/skills\/([^\/]+)\/agents$/)
  if (skillAgentsMatch && req.method === 'PUT') {
    const name = decodeURIComponent(skillAgentsMatch[1])
    const body = await readRequestBody(req)
    if (!Array.isArray(body.agentIds)) { sendJson(res, 400, { error: 'agentIds must be an array' }); return }
    saveSkillAgents(name, body.agentIds)
    sendJson(res, 200, { name, assignedTo: body.agentIds })
    return
  }

  // ── Agent Config Receiver (Thalamus → Soma push) ────────────────────
  // Thalamus llama a este endpoint cuando crea/actualiza un agente.
  // Soma guarda la config en el filesystem del agente. Runtime no depende de Thalamus.
  if (url === '/api/agents' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req)
      const { agent_id, system_prompt, skills, engine } = body
      if (!agent_id) { sendJson(res, 400, { error: 'agent_id required' }); return }

      // Guardar config en el home del agente
      const home = agentHome(agent_id)
      const cfgDir = join(home, '.pi', 'agent')
      if (!existsSync(cfgDir)) mkdirSync(cfgDir, { recursive: true })

      const config = {
        agent_id,
        system_prompt: system_prompt || null,
        skills: skills || [],
        engine: engine || 'pi',
        updated_at: new Date().toISOString(),
      }
      writeFileSync(join(cfgDir, 'config.json'), JSON.stringify(config, null, 2))

      // Si el sandbox no existe, crearlo
      if (!sandboxExists(agent_id)) {
        prepareAgent(agent_id, skills || [])
      }

      console.log(`📥 Agent config pushed: ${agent_id.slice(0, 12)} skills=[${(skills || []).join(',')}]`)
      sendJson(res, 200, { ok: true, agent_id })
    } catch (err: any) {
      console.error('❌ POST /api/agents failed:', err.message)
      sendJson(res, 500, { error: err.message })
    }
    return
  }

  // ── Previews API ──────────────────────────────────────────────────────

  if (url === '/api/previews' && req.method === 'GET') {
    try {
      const pmRes = await fetch('http://preview-manager:3009/api/previews')
      if (pmRes.ok) {
        sendJson(res, 200, await pmRes.json())
      } else {
        throw new Error('Preview Manager returned non-200')
      }
    } catch {
      sendJson(res, 200, { previews: [], count: 0 })
    }
    return
  }

  // Health check fallback
  res.writeHead(200)
  res.end('Agent RPC OK')
})

// ── WebSocket Server ────────────────────────────────────────────────────────

// Mapa: WebSocket → { bridge, agentId, conversationId }
const sessions = new Map<WebSocket, {
  bridge: RpcBridge
  agentId: string
  conversationId: string
  assistantContent: string
  assistantThinking: string
  assistantTools: Array<{ name: string; input: unknown; result?: string }>
  promptAborted: boolean
}>()

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws: WebSocket) => {
  console.log('📡 RPC client connected')

  ws.on('message', async (raw) => {
    let json: any
    try {
      json = JSON.parse(raw.toString())
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
      return
    }

    const { type, text, uid, cid, token } = json

    // ── init: preparar sandbox → spawn pi → bridge ─────────────────────
    if (type === 'init') {
      const agentId = uid || ''
      const conversationId = cid || ''
      const userToken = token || ''

      // Limpiar sesión anterior si existe
      const prev = sessions.get(ws)
      if (prev) {
        prev.bridge.stop()
        sessions.delete(ws)
      }

      // 1. Obtener config del agente (skills, system prompt)
      const config = fetchAgentSkills(agentId)
      console.log(`🔧 Init: agent=${agentId} conv=${conversationId} skills=[${config.skills.join(',')}]`)

      // 2. Preparar sandbox Linux (crear usuario, copiar skills)
      let sandbox
      try {
        sandbox = prepareAgent(agentId, config.skills)
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', message: `Sandbox creation failed: ${err.message}` }))
        console.error(`❌ Sandbox creation failed for ${agentId}:`, err.message)
        return
      }

      // 3. Crear RPC bridge
      const bridge = new RpcBridge({
        username: sandbox.username,
        home: sandbox.home,
        systemPrompt: config.systemPrompt,
      })

      // Guardar token para pasar a pi como variable de entorno
      if (userToken) {
        process.env.ZEA_TOKEN = userToken
      }

      // 4. Datos de sesión
      const sessionData = {
        bridge,
        agentId,
        conversationId,
        assistantContent: '',
        assistantThinking: '',
        assistantTools: [] as Array<{ name: string; input: unknown; result?: string }>,
        promptAborted: false,
      }

      // 5. Suscribir a eventos del bridge → forward a WebSocket
      bridge.on('ready', () => {
        ws.send(JSON.stringify({ type: 'ready' }))
        console.log(`✅ Bridge ready: ${sandboxUsername(agentId)}`)
      })

      bridge.on('thinking_start', () => {
        ws.send(JSON.stringify({ type: 'thinking_start' }))
      })

      bridge.on('thinking', (text: string) => {
        sessionData.assistantThinking += text
        ws.send(JSON.stringify({ type: 'thinking', text }))
      })

      bridge.on('thinking_end', () => {
        ws.send(JSON.stringify({ type: 'thinking_end' }))
      })

      bridge.on('delta', (text: string) => {
        sessionData.assistantContent += text
        ws.send(JSON.stringify({ type: 'delta', text }))
      })

      bridge.on('tool_use', (name: string, input: unknown) => {
        sessionData.assistantTools.push({ name, input })
        ws.send(JSON.stringify({ type: 'tool', name, input }))
      })

      bridge.on('tool_result', (content: string) => {
        const lastTool = sessionData.assistantTools[sessionData.assistantTools.length - 1]
        if (lastTool) lastTool.result = content
        ws.send(JSON.stringify({ type: 'tool_result', content }))
      })

      bridge.on('done', () => {
        ws.send(JSON.stringify({ type: 'done' }))

        // Persistir mensaje del asistente
        const content = sessionData.assistantContent.trim()
        if (content || sessionData.assistantTools.length > 0) {
          addMessage(conversationId, {
            role: 'assistant',
            content: content || '(sin respuesta)',
            thinking: sessionData.assistantThinking.trim() || undefined,
            tools: sessionData.assistantTools.length > 0 ? sessionData.assistantTools : undefined,
          }).catch((err: any) => console.warn('⚠️  Failed to persist assistant message:', err.message))
        }

        // Reset para próximo prompt
        sessionData.assistantContent = ''
        sessionData.assistantThinking = ''
        sessionData.assistantTools = []
        sessionData.promptAborted = false
      })

      bridge.on('error', (message: string) => {
        ws.send(JSON.stringify({ type: 'error', message }))
      })

      bridge.on('disconnected', (code: number | null) => {
        if (!sessionData.promptAborted && code !== 0 && code !== null) {
          ws.send(JSON.stringify({ type: 'error', message: `Agent process exited with code ${code}` }))
        }
      })

      // 6. Arrancar el subproceso
      bridge.start()
      sessions.set(ws, sessionData)

      return
    }

    // ── cancel ──────────────────────────────────────────────────────────
    if (type === 'cancel') {
      const session = sessions.get(ws)
      if (session) {
        console.log(`⏹️  Cancel requested for ${session.agentId.slice(0, 12)}`)
        session.promptAborted = true
        session.bridge.abort()
        // Reset accumulators
        session.assistantContent = ''
        session.assistantThinking = ''
        session.assistantTools = []
        ws.send(JSON.stringify({ type: 'cancelled' }))
      }
      return
    }

    // ── prompt ─────────────────────────────────────────────────────────
    if (type === 'prompt') {
      if (!text?.trim()) return

      const session = sessions.get(ws)
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not initialized. Send init first.' }))
        return
      }

      console.log(`💬 Prompt [${session.agentId.slice(0, 12)}]: "${text.slice(0, 60)}..."`)

      // Persistir mensaje del usuario
      try {
        await addMessage(session.conversationId, { role: 'user', content: text })
      } catch (err: any) {
        console.warn(`⚠️  Failed to persist user message: ${err.message}`)
      }

      session.bridge.sendPrompt(text)
      return
    }

    ws.send(JSON.stringify({ type: 'error', message: 'Unknown command' }))
  })

  ws.on('close', () => {
    console.log('📡 RPC client disconnected')

    // Limpiar bridge al desconectar
    const session = sessions.get(ws)
    if (session) {
      session.bridge.stop()
      sessions.delete(ws)
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`🚀 Agent RPC WebSocket + HTTP on ws://0.0.0.0:${PORT}`)
  console.log(`   Modo: subprocesos pi --mode rpc aislados por usuario Linux`)
})

// ── Skills auto-discovery watcher ──────────────────────────────────────────

let activeAgentId = ''
if (!existsSync(SKILLS_CUSTOM_DIR)) mkdirSync(SKILLS_CUSTOM_DIR, { recursive: true })

// Track known skills
const knownSkills = new Set<string>()
if (existsSync(SKILLS_CUSTOM_DIR)) {
  for (const entry of readdirSync(SKILLS_CUSTOM_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) knownSkills.add(entry.name)
  }
}

try {
  watch(SKILLS_CUSTOM_DIR, { recursive: false }, (_eventType, filename) => {
    if (!filename || filename === '.registry.json') return
    const skillDir = join(SKILLS_CUSTOM_DIR, filename)
    const mdPath = join(skillDir, 'SKILL.md')
    if (existsSync(mdPath) && !knownSkills.has(filename)) {
      knownSkills.add(filename)
      console.log(`🆕 Nueva skill detectada: ${filename}`)
      if (activeAgentId) {
        saveSkillAgents(filename, [activeAgentId])
        skillsVersion++
      }
    }
  })
} catch (err) {
  console.warn('⚠️  Skills watcher not available:', (err as Error).message)
}
