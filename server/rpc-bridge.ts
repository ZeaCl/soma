/**
 * RPC Bridge — spawnea `pi --mode rpc` como usuario Linux aislado
 * y bridgea el protocolo JSONL stdin/stdout ↔ eventos tipados.
 *
 * El orquestador (agent-rpc.ts) corre como root dentro del container.
 * Root spawnea el proceso directamente con uid/gid del agente:
 *
 *   spawn('pi', ['--mode','rpc',...], { uid: 1001, gid: 1001, env: { HOME: '/home/poeta1' } })
 *
 * El kernel crea el proceso como ese usuario. Sin su, sin sudo, sin contraseña.
 * HOME apunta al home del agente → ~/.agents/skills/ = solo sus skills.
 */

import { spawn } from 'child_process'
import { EventEmitter } from 'events'

export interface RpcBridgeOptions {
  username: string
  home: string
  systemPrompt?: string | null
  provider?: string
  model?: string
}

// ── RPC Bridge ─────────────────────────────────────────────────────────────

export class RpcBridge extends EventEmitter {
  private proc: ReturnType<typeof spawn> | null = null
  private opts: RpcBridgeOptions
  private currentTextContent: string[] = []
  private currentThinking: string[] = []
  private inThinking = false

  constructor(opts: RpcBridgeOptions) {
    super()
    this.opts = opts
  }

  /** Arranca el subproceso pi --mode rpc como el usuario Linux del agente */
  start(): void {
    if (this.proc) return

    const { username, home, systemPrompt, provider, model } = this.opts

    const piArgs = ['--mode', 'rpc', '--session-dir', `${home}/.pi-sessions`]
    if (systemPrompt) piArgs.push('--system-prompt', systemPrompt)
    if (provider) piArgs.push('--provider', provider)
    if (model) piArgs.push('--model', model)

    // sudo -u <username> bash -c 'HOME=<home> DEEPSEEK_API_KEY=... ZEA_TOKEN=... pi ...'
    // Las API keys y tokens se pasan explícitamente porque sudo limpia el entorno
    const extraEnv = ['DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ZEA_TOKEN']
      .map(k => process.env[k] ? `${k}=${process.env[k]}` : '')
      .filter(Boolean)
      .join(' ')
    const piCmd = `${extraEnv} HOME=${home} pi ${piArgs.map(a => JSON.stringify(a)).join(' ')}`
    const args = ['-u', username, 'bash', '-c', piCmd]

    console.log(`🔵 RpcBridge: sudo -u ${username} pi --mode rpc`)
    console.log(`   cmd: ${piCmd.slice(0, 120)}...`)

    this.proc = spawn('sudo', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    console.log(`   pid=${this.proc.pid}`)

    this.attachJsonlReader(this.proc.stdout!, line => {
      try { this.handleRpcEvent(JSON.parse(line)) } catch { /* ignore */ }
    })

    this.proc.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim()
      if (text) console.log(`[pi:${home.split('/').pop()}] ${text}`)
    })

    this.proc.on('exit', code => {
      console.log(`🔴 RpcBridge exit code=${code}`)
      this.emit('disconnected', code)
      this.proc = null
    })

    this.proc.on('error', err => {
      console.error(`❌ RpcBridge spawn error: ${err.message}`)
      this.emit('error', `Failed to spawn agent process: ${err.message}`)
      this.proc = null
    })

    this.emit('ready')
  }

  stop(): void {
    if (!this.proc) return
    this.proc.kill('SIGTERM')
    setTimeout(() => { if (this.proc) { this.proc.kill('SIGKILL'); this.proc = null } }, 3000)
  }

  sendPrompt(text: string): void {
    if (!this.proc?.stdin) { this.emit('error', 'Agent process not running'); return }
    this.currentTextContent = []
    this.currentThinking = []
    this.inThinking = false
    this.proc.stdin.write(JSON.stringify({ type: 'prompt', message: text }) + '\n')
  }

  abort(): void {
    if (!this.proc?.stdin) return
    this.proc.stdin.write(JSON.stringify({ type: 'abort' }) + '\n')
  }

  // ── RPC event handling ─────────────────────────────────────────────────

  private handleRpcEvent(event: any): void {
    if (event.type === 'response') return
    switch (event.type) {
      case 'message_update': this.handleMessageUpdate(event); break
      case 'tool_execution_start': this.emit('tool_use', event.toolName, event.args); break
      case 'tool_execution_end':
        if (event.result?.content?.[0]?.text) this.emit('tool_result', event.result.content[0].text)
        break
      case 'agent_end': if (!event.willRetry) this.emit('done'); break
      case 'extension_ui_request':
        if (['select', 'confirm', 'input', 'editor'].includes(event.method)) {
          const resp: any = { type: 'extension_ui_response', id: event.id }
          if (event.method === 'confirm') resp.confirmed = false
          else resp.cancelled = true
          this.proc?.stdin?.write(JSON.stringify(resp) + '\n')
        }
        break
    }
  }

  private handleMessageUpdate(event: any): void {
    const delta = event.assistantMessageEvent
    if (!delta) return
    switch (delta.type) {
      case 'text_delta': this.currentTextContent.push(delta.delta); this.emit('delta', delta.delta); break
      case 'thinking_start': this.inThinking = true; this.emit('thinking_start'); break
      case 'thinking_delta': this.currentThinking.push(delta.delta); this.emit('thinking', delta.delta); break
      case 'thinking_end': this.inThinking = false; this.emit('thinking_end'); break
      case 'error': this.emit('error', `Agent error: ${delta.reason || 'unknown'}`); break
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
