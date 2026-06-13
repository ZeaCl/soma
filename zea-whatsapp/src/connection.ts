import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import path from 'path'
import fs from 'fs'
import qrcode from 'qrcode-terminal'

const AUTH_DIR = path.join(process.cwd(), 'data', 'auth')
fs.mkdirSync(AUTH_DIR, { recursive: true })

// Logger silencioso para Baileys — sus logs internos son muy verbosos
const baileysLogger = pino({ level: 'silent' })

export type MessageHandler = (socket: WASocket) => void

export async function createConnection(onReady: MessageHandler): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const socket = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    logger: baileysLogger,
    printQRInTerminal: false, // lo manejamos nosotros para mejor UX
    syncFullHistory: false,   // solo mensajes nuevos, no historial completo
    markOnlineOnConnect: false, // no aparecer "en línea" automáticamente
    generateHighQualityLinkPreview: false,
  })

  // Guardar credenciales cada vez que cambien
  socket.ev.on('creds.update', saveCreds)

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('\n📱 Escanea este QR con WhatsApp > Dispositivos vinculados:\n')
      qrcode.generate(qr, { small: true })
      console.log()
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp conectado')
      onReady(socket)
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      console.log(
        shouldReconnect
          ? `⚠️  Conexión cerrada (código ${statusCode}), reconectando...`
          : '🔴 Sesión cerrada. Ejecuta de nuevo para escanear QR.'
      )

      if (shouldReconnect) {
        // Espera progresiva antes de reconectar para no saturar
        await new Promise((r) => setTimeout(r, 3000))
        createConnection(onReady)
      } else {
        process.exit(0)
      }
    }
  })

  return socket
}
