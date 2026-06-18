/**
 * User Sandbox — prepara el entorno Linux aislado para un usuario humano.
 *
 * Flujo:
 *   prepareUser(userId, orgId)
 *     1. Ejecuta soma-user-useradd → crea usuario Linux + home
 *     2. Crea {home}/workspace/
 *     3. Asegura directorios compartidos de la org
 *     4. Retorna { uid, gid, home, username }
 *
 *   destroyUser(userId)
 *     1. Ejecuta soma-user-userdel → borra usuario + home
 *
 * Diferencias con agent-sandbox.ts:
 *   - Username: user-{shortId} (no soma-{shortId})
 *   - Home: /home/user-{shortId}/
 *   - Sin skills (no ejecuta pi)
 *   - Workspace personal + acceso a shared/ de la org
 */

import { execSync, execFileSync } from 'child_process'
import { existsSync, mkdirSync, chmodSync, chownSync } from 'fs'
import { join } from 'path'

// ── Config ────────────────────────────────────────────────────────────────

const USERADD_SCRIPT = '/usr/local/bin/soma-user-useradd'
const USERDEL_SCRIPT = '/usr/local/bin/soma-user-userdel'
const ORGS_WORKSPACE = '/workspace/orgs'

export interface SandboxUser {
  uid: number
  gid: number
  home: string
  username: string
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Prepara el sandbox para un usuario humano:
 * - Crea usuario Linux con soma-user-useradd
 * - Crea directorios de trabajo
 * - Asegura directorios compartidos de la organización
 */
export function prepareUser(userId: string, orgId: string, teams?: string): SandboxUser {
  const username = userUsername(userId)
  const home = userHome(userId)

  // 1. Crear usuario Linux si no existe
  ensureUser(userId, orgId, username, home, teams)

  // 2. Resolver uid/gid
  const uid = getUid(username)
  const gid = getGid(username)

  // 3. Crear directorios de trabajo
  ensureDir(join(home, 'workspace'), uid, gid)
  ensureDir(join(home, '.config'), uid, gid)

  // 4. Asegurar directorios compartidos de la organización
  ensureOrgShared(orgId)

  console.log(`🏠 User sandbox listo: ${username} uid=${uid} home=${home} org=${orgId}`)

  return { uid, gid, home, username }
}

/**
 * Destruye el sandbox de un usuario (usuario + home).
 */
export function destroyUser(userId: string): void {
  try {
    execFileSync(USERDEL_SCRIPT, [userId], { stdio: 'pipe', timeout: 10000 })
    console.log(`🗑️  User sandbox destruido: ${userId}`)
  } catch (err: any) {
    if (err.stderr) console.warn(`⚠️  userdel warning: ${String(err.stderr).slice(0, 200)}`)
  }
}

/**
 * Verifica si un usuario tiene sandbox creado.
 */
export function userSandboxExists(userId: string): boolean {
  const home = userHome(userId)
  return existsSync(home) && existsSync(join(home, 'workspace'))
}

/**
 * Nombre de usuario Linux para un userId.
 */
export function userUsername(userId: string): string {
  return `user-${userId.slice(0, 12)}`
}

/**
 * Home directory para un userId.
 */
export function userHome(userId: string): string {
  return join('/home', userUsername(userId))
}

// ── Shared Org Workspace ──────────────────────────────────────────────────

/**
 * Asegura el directorio compartido de la organización.
 *
 * /workspace/orgs/{orgId}/shared/ → grupo org-{orgId}, chmod 2770 (setgid)
 * El setgid bit (g+s) hace que archivos nuevos hereden el grupo automáticamente.
 * Cualquier miembro del grupo org-{orgId} puede leer y escribir.
 */
export function ensureOrgShared(orgId: string): string {
  const groupName = `org-${orgId}`
  const sharedDir = join(ORGS_WORKSPACE, orgId, 'shared')

  if (!existsSync(sharedDir)) {
    mkdirSync(sharedDir, { recursive: true })
    // Intentar setear grupo y permisos
    try {
      execSync(`chgrp ${groupName} ${sharedDir} 2>/dev/null || true`)
      chmodSync(sharedDir, 0o2770) // setgid + rwx para owner y grupo
    } catch { /* non-fatal en desarrollo */ }
    console.log(`📁 Shared org workspace: ${sharedDir} (grupo: ${groupName})`)
  }

  return sharedDir
}

/**
 * Asegura un directorio compartido para un team específico dentro de la org.
 *
 * /workspace/orgs/{orgId}/teams/{teamId}/ → grupo team-{teamId}, chmod 2770
 */
export function ensureTeamShared(orgId: string, teamId: string): string {
  const groupName = `team-${teamId}`
  const teamDir = join(ORGS_WORKSPACE, orgId, 'teams', teamId)

  if (!existsSync(teamDir)) {
    mkdirSync(teamDir, { recursive: true })
    try {
      execSync(`chgrp ${groupName} ${teamDir} 2>/dev/null || true`)
      chmodSync(teamDir, 0o2770)
    } catch { /* non-fatal */ }
    console.log(`📁 Team workspace: ${teamDir} (grupo: ${groupName})`)
  }

  return teamDir
}

/**
 * Lista los directorios compartidos accesibles para un usuario.
 */
export function listSharedDirs(orgId: string): string[] {
  const dirs: string[] = []
  const sharedDir = join(ORGS_WORKSPACE, orgId, 'shared')
  const teamsDir = join(ORGS_WORKSPACE, orgId, 'teams')

  if (existsSync(sharedDir)) dirs.push(sharedDir)
  if (existsSync(teamsDir)) {
    try {
      const { readdirSync } = require('fs')
      for (const entry of readdirSync(teamsDir, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(join(teamsDir, entry.name))
      }
    } catch { /* ignore */ }
  }

  return dirs
}

// ── Helpers ───────────────────────────────────────────────────────────────

function ensureUser(userId: string, orgId: string, username: string, home: string, teams?: string): void {
  if (userExists(username)) {
    console.log(`👤 Usuario ${username} ya existe — reutilizando`)
    // Asegurar que está en el grupo de la org
    try { execSync(`usermod -aG org-${orgId} ${username} 2>/dev/null || true`) } catch {}
    return
  }

  console.log(`👤 Creando usuario Linux: ${username}`)
  try {
    execFileSync(USERADD_SCRIPT, [userId, orgId, teams || ''], {
      stdio: 'inherit',
      timeout: 15000,
    })
  } catch (err: any) {
    throw new Error(`useradd failed for ${userId}: ${err.message}`)
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
