/**
 * Test Aislamiento DEBUG — con stderr visible
 */

import { RpcBridge } from './rpc-bridge.js'
import { mkdirSync, existsSync, cpSync } from 'fs'

const HOME_A = '/tmp/soma-test-financiero'
const HOME_B = '/tmp/soma-test-medico'

// Limpiar sesiones anteriores
for (const h of [HOME_A, HOME_B]) {
  try { require('fs').rmSync(`${h}/.pi-sessions`, { recursive: true, force: true }) } catch {}
  mkdirSync(`${h}/.pi-sessions`, { recursive: true })
  mkdirSync(`${h}/.agents/skills`, { recursive: true })
  
  // Asegurar auth y settings
  const agentCfg = `${h}/.pi/agent`
  if (!existsSync(agentCfg)) mkdirSync(agentCfg, { recursive: true })
  const hostCfg = `${process.env.HOME}/.pi/agent`
  for (const f of ['auth.json', 'settings.json']) {
    if (existsSync(`${hostCfg}/${f}`) && !existsSync(`${agentCfg}/${f}`)) {
      cpSync(`${hostCfg}/${f}`, `${agentCfg}/${f}`)
    }
  }
}

console.log('🧪 Test Aislamiento (DEBUG)')
console.log('')

let doneCount = 0
function checkDone(id: string) {
  doneCount++
  console.log(`🏁 ${id} done (${doneCount}/2)`)
  if (doneCount >= 2) {
    console.log('\n🎉 AISLAMIENTO OK')
    process.exit(0)
  }
}

// Agente A
const a = new RpcBridge({
  uid: 501, gid: 20, home: HOME_A,
  systemPrompt: 'Sos un experto en FINANZAS. Cuando te pregunten de qué sabés, SIEMPRE respondé mencionando inversiones, mercados, o capital. Respondé en 1 frase.',
})
a.on('ready', () => console.log('✅ A ready'))
a.on('thinking_start', () => console.log('🧠 A thinking'))
a.on('delta', (t: string) => process.stdout.write(`[A] ${t}`))
a.on('done', () => { console.log('\n✅ A done'); checkDone('A') })
a.on('error', (m: string) => console.error('❌ A:', m))
a.on('disconnected', (c: number | null) => console.log(`🔌 A exit=${c}`))

// Agente B
const b = new RpcBridge({
  uid: 501, gid: 20, home: HOME_B,
  systemPrompt: 'Sos un MÉDICO CLÍNICO. Cuando te pregunten de qué sabés, SIEMPRE respondé mencionando salud, diagnóstico, o pacientes. Respondé en 1 frase.',
})
b.on('ready', () => console.log('✅ B ready'))
b.on('thinking_start', () => console.log('🧠 B thinking'))
b.on('delta', (t: string) => process.stdout.write(`[B] ${t}`))
b.on('done', () => { console.log('\n✅ B done'); checkDone('B') })
b.on('error', (m: string) => console.error('❌ B:', m))
b.on('disconnected', (c: number | null) => console.log(`🔌 B exit=${c}`))

a.start()
b.start()

setTimeout(() => {
  console.log('\n💬 Preguntando...')
  a.sendPrompt('¿de qué sabés? ¿cuál es tu especialidad? Respondé en 1 frase.')
  b.sendPrompt('¿de qué sabés? ¿cuál es tu especialidad? Respondé en 1 frase.')
}, 2000)

setTimeout(() => {
  console.error('\n⏱️ TIMEOUT')
  a.stop(); b.stop(); process.exit(1)
}, 45000)
