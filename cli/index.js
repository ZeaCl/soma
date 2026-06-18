#!/usr/bin/env node
/**
 * soma — CLI for ZEA Soma AgentHub
 *
 * Usage:
 *   soma user-sandbox create <user-id> --org <org-id> [--teams a,b]
 *   soma user-sandbox destroy <user-id>
 *   soma user-sandbox files <user-id> [--path <subpath>] [--base-url <url>]
 *   soma user-sandbox upload <user-id> <local-file> [--path <remote-dir>]
 *   soma user-sandbox exists <user-id>
 *   soma org-workspace list <org-id> [--base-url <url>]
 *   soma org-workspace shared-dir <org-id>
 *
 * Auth: ZEA_TOKEN env var or --token flag
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

// ── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = process.env.SOMA_URL || 'http://soma.zea.localhost'
const ZEA_TOKEN = process.env.ZEA_TOKEN || ''

function getBaseUrl(args) {
  const idx = args.indexOf('--base-url')
  return idx >= 0 ? args[idx + 1] : DEFAULT_BASE_URL
}

function getToken(args) {
  const idx = args.indexOf('--token')
  return idx >= 0 ? args[idx + 1] : ZEA_TOKEN
}

function getTestUser(args) {
  const idx = args.indexOf('--test-user')
  return idx >= 0 ? args[idx + 1] : null
}

function getOrg(args) {
  const idx = args.indexOf('--org')
  return idx >= 0 ? args[idx + 1] : process.env.ZEA_ORG_ID || ''
}

function getTeams(args) {
  const idx = args.indexOf('--teams')
  return idx >= 0 ? args[idx + 1] : ''
}

function getPath(args) {
  const idx = args.indexOf('--path')
  return idx >= 0 ? args[idx + 1] : ''
}

// ── HTTP ───────────────────────────────────────────────────────────────────

async function apiRequest(method, urlPath, body, baseUrl, token) {
  const url = new URL(urlPath, baseUrl)
  const isHttps = url.protocol === 'https:'
  const mod = isHttps ? https : http

  const headers = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  // Dev bypass: x-test-user-id
  const testUser = getTestUser(process.argv.slice(2))
  if (testUser) headers['x-test-user-id'] = testUser

  const options = {
    method,
    headers,
    rejectUnauthorized: false, // dev only
  }

  return new Promise((resolve, reject) => {
    const req = mod.request(url, options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, body: data })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// ── Commands ───────────────────────────────────────────────────────────────

async function cmdUserSandboxCreate(userId, args) {
  const orgId = getOrg(args)
  const teams = getTeams(args)
  const baseUrl = getBaseUrl(args)
  const token = getToken(args)
  const testUser = getTestUser(args)

  if (!orgId) {
    console.error('❌ --org <org-id> is required')
    process.exit(1)
  }

  console.log(`👤 Creating user sandbox for ${userId}...`)
  const params = new URLSearchParams({ type: 'user', user_id: userId, org_id: orgId })
  if (teams) params.set('teams', teams)
  
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (testUser) headers['x-test-user-id'] = testUser

  const url = new URL(`/api/sandboxes/create?${params}`, baseUrl)
  const isHttps = url.protocol === 'https:'
  const mod = isHttps ? require('https') : require('http')

  const res = await new Promise((resolve, reject) => {
    mod.get(url, { headers, rejectUnauthorized: false }, (resp) => {
      let data = ''
      resp.on('data', (chunk) => { data += chunk })
      resp.on('end', () => {
        try { resolve({ status: resp.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: resp.statusCode, body: data }) }
      })
    }).on('error', reject)
  })

  if (res.status === 201) {
    console.log(`✅ Created: ${res.body.username}`)
    console.log(`   Home:  ${res.body.home}`)
    console.log(`   UID:   ${res.body.uid}`)
  } else {
    console.error(`❌ Failed (${res.status}):`, res.body.error || res.body)
    process.exit(1)
  }
}

async function cmdUserSandboxDestroy(userId, args) {
  const baseUrl = getBaseUrl(args)
  const token = getToken(args)

  console.log(`🗑️  Destroying user sandbox for ${userId}...`)
  const res = await apiRequest('DELETE', `/api/sandboxes/${encodeURIComponent(userId)}?type=user`, null, baseUrl, token)

  if (res.status === 200) {
    console.log(`✅ Destroyed: ${userId}`)
  } else {
    console.error(`❌ Failed (${res.status}):`, res.body.error || res.body)
    process.exit(1)
  }
}

async function cmdUserSandboxFiles(userId, args) {
  const baseUrl = getBaseUrl(args)
  const token = getToken(args)
  const subPath = getPath(args)

  const params = new URLSearchParams({ owner_type: 'user', owner_id: userId })
  if (subPath) params.set('path', subPath)
  const res = await apiRequest('GET', `/api/files/unified?${params}`, null, baseUrl, token)

  if (res.status === 200 && res.body.files) {
    if (res.body.files.length === 0) {
      console.log('📭 No files' + (subPath ? ` in ${subPath}` : ''))
      return
    }
    console.log(`📁 Files for ${userId}${subPath ? '/' + subPath : ''}:`)
    for (const f of res.body.files) {
      const icon = f.type === 'dir' ? '📁' : '📄'
      const size = f.type === 'dir' ? '—' : formatSize(f.size)
      console.log(`   ${icon} ${f.name.padEnd(40)} ${size}`)
    }
  } else {
    console.error(`❌ Failed (${res.status}):`, res.body.error || res.body)
    process.exit(1)
  }
}

async function cmdUserSandboxUpload(userId, localFile, args) {
  const baseUrl = getBaseUrl(args)
  const token = getToken(args)
  const remotePath = getPath(args)

  if (!fs.existsSync(localFile)) {
    console.error(`❌ File not found: ${localFile}`)
    process.exit(1)
  }

  const fileName = path.basename(localFile)
  const fileData = fs.readFileSync(localFile)
  const base64Data = fileData.toString('base64')

  console.log(`📤 Uploading ${fileName} (${formatSize(fileData.length)})...`)
  const res = await apiRequest('POST', '/api/files/unified/upload', {
    owner_type: 'user',
    owner_id: userId,
    name: fileName,
    data: base64Data,
    path: remotePath || undefined,
  }, baseUrl, token)

  if (res.status === 200 && res.body.ok) {
    console.log(`✅ Uploaded: ${res.body.path} (${formatSize(res.body.size)})`)
  } else {
    console.error(`❌ Failed (${res.status}):`, res.body.error || res.body)
    process.exit(1)
  }
}

async function cmdUserSandboxExists(userId, args) {
  const baseUrl = getBaseUrl(args)
  const token = getToken(args)

  const params = new URLSearchParams({ owner_type: 'user', owner_id: userId })
  const res = await apiRequest('GET', `/api/files/unified?${params}`, null, baseUrl, token)

  if (res.status === 200) {
    console.log(`✅ Sandbox exists for ${userId}`)
    process.exit(0)
  } else {
    console.log(`❌ Sandbox does not exist for ${userId}`)
    process.exit(1)
  }
}

async function cmdOrgWorkspaceList(orgId, args) {
  const baseUrl = getBaseUrl(args)
  const token = getToken(args)

  const params = new URLSearchParams({ owner_type: 'org', owner_id: '', org_id: orgId })
  const res = await apiRequest('GET', `/api/files/unified?${params}`, null, baseUrl, token)

  if (res.status === 200 && res.body.files) {
    if (res.body.files.length === 0) {
      console.log('📭 No shared files in org workspace')
      return
    }
    console.log(`🏢 Shared files for org ${orgId}:`)
    for (const f of res.body.files) {
      const icon = f.type === 'dir' ? '📁' : '📄'
      const size = f.type === 'dir' ? '—' : formatSize(f.size)
      console.log(`   ${icon} ${f.name.padEnd(40)} ${size}`)
    }
  } else {
    console.error(`❌ Failed (${res.status}):`, res.body.error || res.body)
    process.exit(1)
  }
}

async function cmdOrgWorkspaceSharedDir(orgId) {
  console.log(`/workspace/orgs/${orgId}/shared/`)
  console.log(`   Permissions: 2770 (setgid + rwx for group org-${orgId})`)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function printHelp() {
  console.log(`
🦴 ZEA Soma CLI

Usage:
  soma user-sandbox create <user-id>   --org <org-id> [--teams a,b] [--base-url <url>]
  soma user-sandbox destroy <user-id>  [--base-url <url>]
  soma user-sandbox files <user-id>    [--path <subpath>] [--base-url <url>]
  soma user-sandbox upload <user-id> <local-file> [--path <remote-dir>] [--base-url <url>]
  soma user-sandbox exists <user-id>   [--base-url <url>]

  soma org-workspace list <org-id>     [--base-url <url>]
  soma org-workspace shared-dir <org-id>

Options:
  --org       Organization ID
  --teams     Comma-separated team IDs
  --path      Remote subdirectory path
  --base-url  Soma API URL (default: $SOMA_URL or http://soma.zea.localhost)
  --token     Bearer token (default: $ZEA_TOKEN)

Examples:
  soma user-sandbox create user_abc123 --org org_xyz
  soma user-sandbox files user_abc123 --path excel/2026
  soma user-sandbox upload user_abc123 ./mi-archivo.xlsx
  soma org-workspace list org_xyz
`)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp()
    process.exit(0)
  }

  const cmd = args[0]

  try {
    // user-sandbox commands
    if (cmd === 'user-sandbox') {
      const sub = args[1]
      const validSubs = ['create', 'destroy', 'files', 'upload', 'exists']
      if (!validSubs.includes(sub)) {
        console.error(`❌ Unknown subcommand: ${sub || '(none)'}`)
        console.error('   Try: ' + validSubs.join(', '))
        process.exit(1)
      }
      const userId = args[2]
      if (!userId) { console.error('❌ <user-id> required'); process.exit(1) }

      switch (sub) {
        case 'create': return await cmdUserSandboxCreate(userId, args)
        case 'destroy': return await cmdUserSandboxDestroy(userId, args)
        case 'files': return await cmdUserSandboxFiles(userId, args)
        case 'upload': {
          const localFile = args[3]
          if (!localFile) { console.error('❌ <local-file> required'); process.exit(1) }
          return await cmdUserSandboxUpload(userId, localFile, args)
        }
        case 'exists': return await cmdUserSandboxExists(userId, args)
        default:
          console.error(`❌ Unknown subcommand: ${sub}`)
          console.error('   Try: create, destroy, files, upload, exists')
          process.exit(1)
      }
    }

    // org-workspace commands
    if (cmd === 'org-workspace') {
      const sub = args[1]
      const validSubs = ['list', 'shared-dir']
      if (!validSubs.includes(sub)) {
        console.error(`❌ Unknown subcommand: ${sub || '(none)'}`)
        console.error('   Try: ' + validSubs.join(', '))
        process.exit(1)
      }
      const orgId = args[2]
      if (!orgId) { console.error('❌ <org-id> required'); process.exit(1) }

      switch (sub) {
        case 'list': return await cmdOrgWorkspaceList(orgId, args)
        case 'shared-dir': return cmdOrgWorkspaceSharedDir(orgId)
        default:
          console.error(`❌ Unknown subcommand: ${sub}`)
          console.error('   Try: list, shared-dir')
          process.exit(1)
      }
    }

    console.error(`❌ Unknown command: ${cmd}`)
    console.error('   Try: user-sandbox, org-workspace')
    process.exit(1)
  } catch (err) {
    console.error(`❌ ${err.message}`)
    process.exit(1)
  }
}

main()
