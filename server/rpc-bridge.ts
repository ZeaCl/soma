/**
 * RPC Bridge — spawnea `pi --mode rpc` como usuario Linux aislado
 * y bridgea el protocolo JSONL stdin/stdout ↔ eventos tipados.
 *
 * Uso:
 *   const bridge = new RpcBridge({
 *     uid: 1001, gid: 1001,
 *     home: '/home/soma/agent-uuid',
 *     systemPrompt: 'Eres un agente financiero...',
 *   })
 *   bridge.on('delta', text => ws.send(...))
 *   bridge.on('done', () => ws.send(...))
 *   bridge.start()
 *   bridge.sendPrompt('Hola')
 *   bridge.abort()
 *   bridge.stop()
 */

import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface RpcBridgeOptions {
  uid: number
  gid: number
  home: string
  systemPrompt?: string | null
  /** Provider para pi (si no se usa el default) */
  provider?: string
  /** Modelo para pi (si no se usa el default) */
  model?: string
  /** API key (se pasa como env var) */
  apiKey?: string
}

type RpcBridgeEvent =
  | 'ready' | 'delta' | 'thinking' | 'thinking_start' | 'thinking_end'
  | 'tool_use' | 'tool_result' | 'done' | 'cancelled' | 'error' | 'disconnected'

// ── RPC Bridge ─────────────────────────────────────────────────────────────

export class RpcBridge extends EventEmitter {
  private proc: ReturnType<typeof spawn> | null = null
  private opts: RpcBridgeOptions
  private _ready = false
  private currentTextContent: string[] = []
  private currentThinking: string[] = []
  private inThinking = false

  constructor(opts: RpcBridgeOptions) {
    super()
    this.opts = opts
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────

  /** Arranca el subproceso pi --mode rpc y comienza a escuchar stdout */
  start(): void {
    if (this.proc) return

    const { home, uid, gid, systemPrompt, provider, model, apiKey } = this.opts
    const sessionDir = join(home, '.pi-sessions')
    const workspaceDir = join(home, 'workspace')

    const args: string[] = ['--mode', 'rpc', '--session-dir', sessionDir]
    if (systemPrompt) args.push('--system-prompt', systemPrompt)
    if (provider) args.push('--provider', provider)
    if (model) args.push('--model', model)

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      HOME: home,
      SHELL: process.env.SHELL || '/bin/bash',
      PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    }
    if (apiKey) env.ANTHROPIC_API_KEY = apiKey

    console.log(`🔵 RpcBridge spawn: pi --mode rpc uid=${uid} home=${home}`)
    console.log(`   args: ${args.join(' ')}`)

    this.proc = spawn('pi', args, {
      uid, gid, cwd: workspaceDir, env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    console.log(`   pid=${this.proc.pid}`)

    // stdout: JSONL del protocolo RPC
    this.attachJsonlReader(this.proc.stdout!, (line: string) => {
      try { this.handleRpcEvent(JSON.parse(line)) } catch { /* ignore non-JSON */ }
    })

    // stderr: logs de pi
    this.proc.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim()
      if (text) console.log(`[pi:${home.split('/').pop()}] ${text}`)
    })

    // exit
    this.proc.on('exit', (code) => {
      console.log(`🔴 RpcBridge exit code=${code} home=${home}`)
      this._ready = false
      this.emit('disconnected', code)
      this.proc = null
    })

    // error de spawn
    this.proc.on('error', (err) => {
      console.error(`❌ RpcBridge spawn error: ${err.message}`)
      this.emit('error', `Failed to spawn agent process: ${err.message}`)
      this.proc = null
    })

    // Emitir ready inmediatamente — pi RPC acepta comandos desde el inicio
    this._ready = true
    this.emit('ready')
  }

  /** Detiene el subproceso */
  stop(): void {
    if (!this.proc) return
    console.log(`⏹️  RpcBridge stop`)
    this.proc.kill('SIGTERM')
    setTimeout(() => {
      if (this.proc) { this.proc.kill('SIGKILL'); this.proc = null }
    }, 3000)
  }

  /** Envía un prompt al agente */
  sendPrompt(text: string): void {
    if (!this.proc?.stdin) {
      this.emit('error', 'Agent process not running')
      return
    }
    this.currentTextContent = []
    this.currentThinking = []
    this.inThinking = false
    console.log(`📤 RpcBridge prompt [${this.opts.home.split('/').pop()}]: "${text.slice(0, 60)}..."`)
    this.proc.stdin.write(JSON.stringify({ type: 'prompt', message: text }) + '\n')
  }

  /** Aborta la operación actual */
  abort(): void {
    if (!this.proc?.stdin) return
    console.log(`⏹️  RpcBridge abort`)
    this.proc.stdin.write(JSON.stringify({ type: 'abort' }) + '\n')
  }

  // ── Procesamiento de eventos RPC ───────────────────────────────────────

  private handleRpcEvent(event: any): void {
    if (event.type === 'response') return

    switch (event.type) {
      case 'message_update':
        this.handleMessageUpdate(event)
        break

      case 'tool_execution_start':
        this.emit('tool_use', event.toolName, event.args)
        break

      case 'tool_execution_end':
        if (event.result?.content?.[0]?.text) {
          this.emit('tool_result', event.result.content[0].text)
        }
        break

      case 'agent_end':
        // Emitir done cuando el agente termina por completo
        if (!event.willRetry) this.emit('done')
        break

      case 'compaction_start':
      case 'compaction_end':
      case 'auto_retry_start':
      case 'auto_retry_end':
        console.log(`[pi] ${event.type}`)
        break

      case 'extension_error':
        console.warn(`[pi] extension_error: ${event.error}`)
        break

      case 'extension_ui_request':
        // Rechazar diálogos de extensión automáticamente
        if (['select', 'confirm', 'input', 'editor'].includes(event.method)) {
          const response: any = { type: 'extension_ui_response', id: event.id }
          if (event.method === 'confirm') response.confirmed = false
          else response.cancelled = true
          this.proc?.stdin?.write(JSON.stringify(response) + '\n')
        }
        break
    }
  }

  private handleMessageUpdate(event: any): void {
    const delta = event.assistantMessageEvent
    if (!delta) return

    switch (delta.type) {
      case 'text_start':
        break

      case 'text_delta':
        this.currentTextContent.push(delta.delta)
        this.emit('delta', delta.delta)
        break

      case 'text_end':
        break

      case 'thinking_start':
        this.inThinking = true
        this.emit('thinking_start')
        break

      case 'thinking_delta':
        this.currentThinking.push(delta.delta)
        this.emit('thinking', delta.delta)
        break

      case 'thinking_end':
        this.inThinking = false
        this.emit('thinking_end')
        break

      case 'done':
        // El modelo terminó de generar. El agent puede seguir con tools.
        // El done final se emite en agent_end.
        break

      case 'error':
        this.emit('error', `Agent error: ${delta.reason || 'unknown'}`)
        break
    }
  }

  // ── JSONL framing (compatible con RPC mode, no usa Node readline) ─────

  private attachJsonlReader(stream: NodeJS.ReadableStream, onLine: (line: string) => void): void {
    let buffer = ''

    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8')
      while (true) {
        const idx = buffer.indexOf('\n')
        if (idx === -1) break
        let line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        if (line.length > 0) onLine(line)
      }
    })

    stream.on('end', () => {
      if (buffer.length > 0) {
        let line = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer
        if (line.length > 0) onLine(line)
      }
    })
  }
}
