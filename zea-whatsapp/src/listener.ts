import { WASocket, proto } from '@whiskeysockets/baileys'
import { saveMessage } from './store'
import { classifyMessage } from './classifier'

// Tipos de mensaje que nos interesan capturar
const SUPPORTED_TYPES = new Set([
  'conversation',
  'extendedTextMessage',
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
  'reactionMessage',
  'locationMessage',
  'contactMessage',
])

export function attachListener(socket: WASocket): void {
  socket.ev.on('messages.upsert', ({ messages, type }) => {
    // 'notify' = mensajes nuevos entrantes; 'append' = historial cargado
    if (type !== 'notify') return

    for (const msg of messages) {
      // Ignorar mensajes propios y de estado/broadcast
      if (msg.key.fromMe) continue
      if (msg.key.remoteJid === 'status@broadcast') continue
      if (!msg.message) continue

      const stored = buildStoredMessage(msg)
      if (!stored) continue

      const saved = saveMessage(stored)

      if (saved) {
        const who = stored.is_group
          ? `[${stored.group_name ?? stored.jid}] ${stored.sender_name ?? stored.sender}`
          : stored.sender_name ?? stored.sender

        console.log(`📨 ${new Date(stored.timestamp * 1000).toLocaleTimeString()} | ${who} | ${stored.type}: ${formatContent(stored)}`)

        // Clasificar mensajes de texto en background (no bloquea el listener)
        if (stored.type === 'text' && stored.content) {
          classifyMessage(stored.id, stored.sender_name ?? stored.sender, stored.content).catch(() => {})
        }
      }
    }
  })
}

function buildStoredMessage(msg: proto.IWebMessageInfo) {
  const jid = msg.key.remoteJid!
  const isGroup = jid.endsWith('@g.us')
  const msgId = msg.key.id!

  // Determinar remitente real (en grupos el participante, en DMs el jid)
  const sender = isGroup
    ? (msg.key.participant ?? msg.participant ?? jid)
    : jid

  const senderName = (msg.pushName ?? null)

  const timestamp = typeof msg.messageTimestamp === 'number'
    ? msg.messageTimestamp
    : Number(msg.messageTimestamp ?? Math.floor(Date.now() / 1000))

  const { type, content } = extractContent(msg.message!)

  if (!type) return null

  return {
    id: msgId,
    jid,
    sender,
    sender_name: senderName,
    type,
    content,
    timestamp,
    is_group: isGroup,
    group_name: isGroup ? extractGroupName(jid) : null,
  }
}

function extractContent(message: proto.IMessage): { type: string; content: string | null } {
  if (message.conversation) {
    return { type: 'text', content: message.conversation }
  }

  if (message.extendedTextMessage?.text) {
    return { type: 'text', content: message.extendedTextMessage.text }
  }

  if (message.imageMessage) {
    return {
      type: 'image',
      content: message.imageMessage.caption ?? null,
    }
  }

  if (message.videoMessage) {
    return {
      type: 'video',
      content: message.videoMessage.caption ?? null,
    }
  }

  if (message.audioMessage) {
    const seconds = message.audioMessage.seconds ?? 0
    const isPTT = message.audioMessage.ptt ?? false
    return {
      type: isPTT ? 'voice' : 'audio',
      content: `${seconds}s`,
    }
  }

  if (message.documentMessage) {
    return {
      type: 'document',
      content: message.documentMessage.fileName ?? null,
    }
  }

  if (message.stickerMessage) {
    return { type: 'sticker', content: null }
  }

  if (message.locationMessage) {
    const { degreesLatitude: lat, degreesLongitude: lon } = message.locationMessage
    return { type: 'location', content: `${lat},${lon}` }
  }

  if (message.reactionMessage) {
    return {
      type: 'reaction',
      content: message.reactionMessage.text ?? null,
    }
  }

  if (message.contactMessage) {
    return {
      type: 'contact',
      content: message.contactMessage.displayName ?? null,
    }
  }

  // Tipo desconocido — guardamos igualmente para no perder nada
  const unknownType = Object.keys(message)[0] ?? 'unknown'
  return { type: unknownType, content: null }
}

function extractGroupName(jid: string): string {
  // Baileys no expone el nombre del grupo en el mensaje directamente.
  // Se puede enriquecer después con socket.groupMetadata(jid).
  // Por ahora usamos el jid como fallback.
  return jid.replace('@g.us', '')
}

function formatContent(msg: { type: string; content: string | null }): string {
  if (msg.content) return msg.content.substring(0, 80)
  return `[${msg.type}]`
}
