/**
 * CLI de consulta — corre sin necesitar la conexión WhatsApp activa.
 * Uso: npm run pending
 *      npm run pending -- --all      (muestra todos, no solo no leídos)
 *      npm run pending -- --mark     (marca como leídos al mostrar)
 *      npm run pending -- --last 20  (últimos N mensajes)
 */

import { getUnread, getRecent, getStats, markAsRead } from './store'

const args = process.argv.slice(2)
const showAll = args.includes('--all')
const markRead = args.includes('--mark')
const lastIdx = args.indexOf('--last')
const lastN = lastIdx !== -1 ? parseInt(args[lastIdx + 1] ?? '50', 10) : null

function fmt(ts: number): string {
  const d = new Date(ts * 1000)
  const today = new Date()
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()

  if (isToday) {
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtContent(type: string, content: string | null): string {
  if (type === 'text' && content) return content.length > 120 ? content.substring(0, 117) + '...' : content
  if (type === 'voice') return `🎤 Audio de voz (${content ?? '?'})`
  if (type === 'audio') return `🎵 Audio (${content ?? '?'})`
  if (type === 'image') return content ? `🖼  Imagen: "${content}"` : '🖼  Imagen'
  if (type === 'video') return content ? `🎬 Video: "${content}"` : '🎬 Video'
  if (type === 'document') return `📄 Documento: ${content ?? 'sin nombre'}`
  if (type === 'sticker') return '🪄 Sticker'
  if (type === 'location') return `📍 Ubicación: ${content}`
  if (type === 'reaction') return `${content} (reacción)`
  if (type === 'contact') return `👤 Contacto: ${content}`
  return `[${type}]`
}

function separator(char = '─', n = 60): string {
  return char.repeat(n)
}

// ── Lógica principal ─────────────────────────────────────────────

const stats = getStats()
console.log()
console.log(separator('═'))
console.log('  ZEA WhatsApp — Resumen de mensajes')
console.log(separator('═'))
console.log(`  Total: ${stats.total} | No leídos: ${stats.unread} | Contactos: ${stats.contacts}`)
console.log(separator('─'))

const messages = lastN !== null
  ? getRecent(lastN)
  : showAll
    ? getRecent(200)
    : getUnread()

if (messages.length === 0) {
  console.log('\n  ✅ Sin mensajes pendientes.\n')
  process.exit(0)
}

// Agrupar por contacto/grupo para mejor legibilidad
const grouped = new Map<string, typeof messages>()
for (const m of messages) {
  const key = m.jid
  if (!grouped.has(key)) grouped.set(key, [])
  grouped.get(key)!.push(m)
}

for (const [jid, msgs] of grouped) {
  const first = msgs[0]
  const label = first.is_group
    ? `👥 ${first.group_name ?? jid} (${msgs.length} mens.)`
    : `👤 ${first.sender_name ?? first.sender} (${msgs.length} mens.)`

  console.log(`\n${label}`)
  console.log(separator('·'))

  for (const m of msgs) {
    const readMark = m.is_read ? '  ' : '🔵'
    const who = m.is_group ? ` [${m.sender_name ?? m.sender.split('@')[0]}]` : ''
    console.log(`${readMark} ${fmt(m.timestamp)}${who}  ${fmtContent(m.type, m.content)}`)

    if (markRead && !m.is_read) {
      markAsRead(m.id)
    }
  }
}

console.log()
console.log(separator('─'))

if (markRead) {
  console.log('  ✅ Mensajes marcados como leídos.')
} else if (!showAll && stats.unread > 0) {
  console.log('  💡 Tip: usa --mark para marcarlos como leídos, --all para ver todos.')
}

console.log()
