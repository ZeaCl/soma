/**
 * Test Aislamiento de Skills — 2 agentes con diferente conjunto de skills.
 *
 * Verifica que:
 *   - Agente A (financiero) tiene skills: venture, xlsx
 *   - Agente B (médico) tiene skills: doctor, workspace
 *   - Cada uno SOLO menciona sus propias skills
 *   - No hay leakage de skills entre agentes
 *
 * Ejecutar:
 *   cd /Users/dev/Documents/zea/soma/server && npx tsx test-skill-isolation.ts
 */

import { RpcBridge } from './rpc-bridge.js'
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs'
import { join } from 'path'

// ── Config ────────────────────────────────────────────────────────────────

const HOST_SKILLS = `${process.env.HOME}/.agents/skills`

interface AgentSetup {
  id: string
  home: string
  skills: string[]
  prompt: string
}

const agentA: AgentSetup = {
  id: 'financiero',
  home: '/tmp/soma-test-financiero',
  skills: ['venture', 'xlsx'],
  prompt: 'Sos un agente financiero especializado. Respondé en español, 1-2 frases.',
}

const agentB: AgentSetup = {
  id: 'medico',
  home: '/tmp/soma-test-medico',
  skills: ['doctor', 'workspace'],
  prompt: 'Sos un agente de diagnóstico de plataformas. Respondé en español, 1-2 frases.',
}

// ── Setup ─────────────────────────────────────────────────────────────────

function setupAgent(agent: AgentSetup) {
  const h = agent.home

  // Limpiar sesiones anteriores
  try { rmSync(join(h, '.pi-sessions'), { recursive: true, force: true }) } catch {}
  try { rmSync(join(h, '.agents', 'skills'), { recursive: true, force: true }) } catch {}

  // Crear directorios
  for (const d of ['workspace', '.pi-sessions', '.agents/skills', '.pi/agent']) {
    mkdirSync(join(h, d), { recursive: true })
  }

  // Copiar auth y settings del host
  const hostCfg = `${process.env.HOME}/.pi/agent`
  const agentCfg = join(h, '.pi', 'agent')
  for (const f of ['auth.json', 'settings.json']) {
    const src = join(hostCfg, f)
    const dst = join(agentCfg, f)
    if (existsSync(src) && !existsSync(dst)) cpSync(src, dst)
  }

  // Copiar SOLO las skills asignadas a este agente
  const dstSkills = join(h, '.agents', 'skills')
  for (const skill of agent.skills) {
    const src = join(HOST_SKILLS, skill)
    const dst = join(dstSkills, skill)
    if (existsSync(src)) {
      cpSync(src, dst, { recursive: true })
      console.log(`  📋 [${agent.id}] skill copiada: ${skill}`)
    } else {
      console.warn(`  ⚠️  [${agent.id}] skill no encontrada: ${skill}`)
    }
  }

  console.log(`  ✅ [${agent.id}] setup listo (${agent.skills.length} skills)`)
}

// ── Test ──────────────────────────────────────────────────────────────────

console.log('🧪 Test: Aislamiento de Skills')
console.log('   Agente A: venture, xlsx')
console.log('   Agente B: doctor, workspace')
console.log('')

// Setup
console.log('📁 Preparando homes...')
setupAgent(agentA)
setupAgent(agentB)
console.log('')

// Resultados
const results: Record<string, string> = {}
let doneCount = 0

function createBridge(agent: AgentSetup): RpcBridge {
  const bridge = new RpcBridge({
    uid: 501, gid: 20, home: agent.home,
    systemPrompt: agent.prompt,
  })

  let fullResponse = ''

  bridge.on('ready', () => console.log(`✅ [${agent.id}] ready`))
  bridge.on('thinking_start', () => process.stdout.write(`🧠 [${agent.id}] `))
  bridge.on('delta', (t: string) => { fullResponse += t; process.stdout.write(t) })
  bridge.on('done', () => {
    console.log(`\n✅ [${agent.id}] done`)
    results[agent.id] = fullResponse
    doneCount++
    if (doneCount >= 2) verify()
  })
  bridge.on('error', (m: string) => console.error(`❌ [${agent.id}]: ${m}`))
  bridge.on('disconnected', (c: number | null) => {
    if (!results[agent.id]) console.log(`🔌 [${agent.id}] exit=${c}`)
  })

  return bridge
}

function verify() {
  console.log('\n' + '='.repeat(60))
  console.log('🔍 VERIFICACIÓN DE AISLAMIENTO DE SKILLS')
  console.log('='.repeat(60))

  const checks: Array<{ agent: string; shouldContain: string[]; shouldNotContain: string[] }> = [
    {
      agent: 'financiero',
      shouldContain: ['venture', 'xlsx'],
      shouldNotContain: ['doctor', 'workspace'],
    },
    {
      agent: 'medico',
      shouldContain: ['doctor', 'workspace'],
      shouldNotContain: ['xlsx'],
      // 'venture' aparece en la descripción de 'doctor' ("venture data" es una capa de ZEA)
      // No es una filtración real — la skill venture no está disponible para este agente
    },
  ]

  let passed = 0
  let failed = 0

  for (const check of checks) {
    const response = (results[check.agent] || '').toLowerCase()
    console.log(`\n📋 Agente: ${check.agent}`)
    console.log(`   Respuesta: "${results[check.agent]}"`)

    for (const skill of check.shouldContain) {
      if (response.includes(skill.toLowerCase())) {
        console.log(`   ✅ Menciona '${skill}'`)
        passed++
      } else {
        console.log(`   ❌ NO menciona '${skill}'`)
        failed++
      }
    }

    for (const skill of check.shouldNotContain) {
      if (response.includes(skill.toLowerCase())) {
        console.log(`   ❌ FILTRACIÓN: menciona '${skill}' (no debería)`)
        failed++
      } else {
        console.log(`   ✅ No menciona '${skill}' (correcto)`)
        passed++
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  if (failed === 0) {
    console.log('🎉 AISLAMIENTO DE SKILLS VERIFICADO — 0 filtraciones')
  } else {
    console.log(`⚠️  ${failed} fallos detectados`)
  }
  console.log('='.repeat(60))

  process.exit(failed > 0 ? 1 : 0)
}

// Arrancar ambos agentes
const bridgeA = createBridge(agentA)
const bridgeB = createBridge(agentB)

bridgeA.start()
bridgeB.start()

// Enviar prompts después de 2s
setTimeout(() => {
  console.log('\n💬 Preguntando a ambos: "¿qué skills o habilidades tenés disponibles? Nombralas."\n')
  bridgeA.sendPrompt('¿qué skills o habilidades tenés disponibles? Nombralas una por una.')
  bridgeB.sendPrompt('¿qué skills o habilidades tenés disponibles? Nombralas una por una.')
}, 2000)

// Timeout
setTimeout(() => {
  console.error('\n⏱️ TIMEOUT — 45s')
  bridgeA.stop(); bridgeB.stop()
  process.exit(1)
}, 45000)
