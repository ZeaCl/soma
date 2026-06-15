/**
 * Agent Sandbox — prepara el entorno Linux aislado para un agente.
 *
 * Flujo:
 *   prepareAgent(agentId, skills)
 *     1. Ejecuta soma-agent-useradd → crea usuario Linux + home
 *     2. Copia skills asignadas a {home}/skills/
 *     3. Crea {home}/workspace/ y {home}/.pi-sessions/
 *     4. Retorna { uid, gid, home, username }
 *
 *   destroyAgent(agentId)
 *     1. Ejecuta soma-agent-userdel → borra usuario + home
 */

import { execSync, execFileSync } from 'child_process'
import { existsSync, mkdirSync, cpSync, readdirSync, statSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

// ── Config ────────────────────────────────────────────────────────────────

const SANDBOX_HOME = '/home/soma'
const SKILLS_SOURCE_DIR = '/root/.agents/skills'
const SKILLS_CUSTOM_SOURCE = '/app/.pi-agent-skills'
const USERADD_SCRIPT = '/usr/local/bin/soma-agent-useradd'
const USERDEL_SCRIPT = '/usr/local/bin/soma-agent-userdel'
const ORG_ID = '00000000-0000-0000-0000-000000000000' // default org

export interface SandboxAgent {
  uid: number
  gid: number
  home: string
  username: string
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Prepara el sandbox para un agente:
 * - Crea usuario Linux con soma-agent-useradd
 * - Copia skills asignadas a {home}/skills/
 * - Crea directorios workspace y sesiones
 */
export function prepareAgent(agentId: string, skillNames: string[]): SandboxAgent {
  const username = sandboxUsername(agentId)
  const home = agentHome(agentId)

  // 1. Crear usuario Linux si no existe
  ensureUser(agentId, username, home)

  // 2. Resolver uid/gid
  const uid = getUid(username)
  const gid = getGid(username)

  // 3. Copiar skills asignadas al home del agente
  copySkills(home, skillNames)

  // 4. Copiar auth y settings del host
  copyAgentAuth(home)

  // 5. Crear directorios de trabajo
  ensureDir(join(home, 'workspace'), uid, gid)
  ensureDir(join(home, '.pi-sessions'), uid, gid)

  console.log(`🏠 Sandbox listo: ${username} uid=${uid} home=${home} skills=[${skillNames.join(',')}]`)

  return { uid, gid, home, username }
}

/**
 * Destruye el sandbox de un agente (usuario + home).
 */
export function destroyAgent(agentId: string): void {
  try {
    execFileSync(USERDEL_SCRIPT, [agentId], { stdio: 'pipe', timeout: 10000 })
    console.log(`🗑️  Sandbox destruido: ${agentId}`)
  } catch (err: any) {
    // Puede fallar si el usuario no existe — ignorar
    if (err.stderr) console.warn(`⚠️  userdel warning: ${String(err.stderr).slice(0, 200)}`)
  }
}

/**
 * Verifica si un agente tiene sandbox creado.
 */
export function sandboxExists(agentId: string): boolean {
  const home = agentHome(agentId)
  return existsSync(home) && existsSync(join(home, 'workspace'))
}

/**
 * Nombre de usuario Linux para un agentId.
 */
export function sandboxUsername(agentId: string): string {
  return `soma-${agentId.slice(0, 12)}`
}

/**
 * Home directory para un agentId.
 */
export function agentHome(agentId: string): string {
  return join(SANDBOX_HOME, agentId)
}

// ── Helpers ───────────────────────────────────────────────────────────────

function ensureUser(agentId: string, username: string, home: string): void {
  if (userExists(username)) {
    console.log(`👤 Usuario ${username} ya existe — reutilizando`)
    return
  }

  console.log(`👤 Creando usuario Linux: ${username}`)
  try {
    execFileSync(USERADD_SCRIPT, [agentId, ORG_ID, '', '[]'], {
      stdio: 'inherit',
      timeout: 15000,
    })
  } catch (err: any) {
    throw new Error(`useradd failed for ${agentId}: ${err.message}`)
  }

  if (!existsSync(home)) {
    mkdirSync(home, { recursive: true })
    execSync(`chown ${username}:${username} ${home}`)
  }
}

function userExists(username: string): boolean {
  try {
    execSync(`id -u ${username}`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function getUid(username: string): number {
  try {
    return parseInt(execSync(`id -u ${username}`, { encoding: 'utf-8' }).trim(), 10)
  } catch {
    return 1000
  }
}

function getGid(username: string): number {
  try {
    return parseInt(execSync(`id -g ${username}`, { encoding: 'utf-8' }).trim(), 10)
  } catch {
    return 1000
  }
}

function ensureDir(path: string, uid: number, gid: number): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
    try { execSync(`chown ${uid}:${gid} ${path}`) } catch { /* non-fatal */ }
  }
}

function copySkills(home: string, skillNames: string[]): void {
  // Skills en ~/.agents/skills/ → pi las auto-descubre
  const skillsDir = join(home, '.agents', 'skills')
  mkdirSync(skillsDir, { recursive: true })

  for (const name of skillNames) {
    const srcBuiltin = join(SKILLS_SOURCE_DIR, name)
    const srcCustom = join(SKILLS_CUSTOM_SOURCE, name)
    const dst = join(skillsDir, name)

    // Ya copiada? Saltar
    if (existsSync(dst) && existsSync(join(dst, 'SKILL.md'))) continue

    // Intentar desde built-in, luego custom
    if (existsSync(srcBuiltin) && existsSync(join(srcBuiltin, 'SKILL.md'))) {
      cpSync(srcBuiltin, dst, { recursive: true })
      console.log(`   📋 Skill copiada: ${name} (builtin)`)
    } else if (existsSync(srcCustom) && existsSync(join(srcCustom, 'SKILL.md'))) {
      cpSync(srcCustom, dst, { recursive: true })
      console.log(`   📋 Skill copiada: ${name} (custom)`)
    } else {
      console.warn(`   ⚠️  Skill no encontrada: ${name}`)
    }
  }

  // Copiar también skills custom que este agente haya creado previamente
  if (existsSync(SKILLS_CUSTOM_SOURCE)) {
    const registry = readSkillRegistry()
    for (const [skillName, agentIds] of Object.entries(registry)) {
      // Solo si esta skill fue asignada a este agente (por nombre o por registry)
      if (skillNames.includes(skillName) || agentIds.includes(home.split('/').pop()!)) {
        const srcCustomDir = join(SKILLS_CUSTOM_SOURCE, skillName)
        const dstCustom = join(skillsDir, skillName)
        if (existsSync(srcCustomDir) && !existsSync(dstCustom)) {
          cpSync(srcCustomDir, dstCustom, { recursive: true })
          console.log(`   📋 Skill copiada: ${skillName} (custom registry)`)
        }
      }
    }
  }
}

function readSkillRegistry(): Record<string, string[]> {
  try {
    const regPath = join(SKILLS_CUSTOM_SOURCE, '.registry.json')
    if (existsSync(regPath)) {
      return JSON.parse(readFileSync(regPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return {}
}

}

/**
 * Copia auth.json y settings.json al home del agente.
 * En Docker, las API keys vienen por env vars — esto es fallback para desarrollo local.
 */
function copyAgentAuth(home: string): void {
  const hostAuthDir = join(process.env.HOME || '/root', '.pi', 'agent')
  const agentAuthDir = join(home, '.pi', 'agent')
  mkdirSync(agentAuthDir, { recursive: true })

  for (const file of ['auth.json', 'settings.json']) {
    const src = join(hostAuthDir, file)
    const dst = join(agentAuthDir, file)
    if (existsSync(src) && !existsSync(dst)) {
      try {
        cpSync(src, dst)
        console.log(`   📋 ${file} copiado al agente`)
      } catch (err: any) {
        console.warn(`   ⚠️  No se pudo copiar ${file}: ${err.message}`)
      }
    }
  }
}
