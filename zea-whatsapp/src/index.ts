import { createConnection } from './connection'
import { attachListener } from './listener'
import { getStats } from './store'

async function main() {
  console.log('🚀 ZEA WhatsApp — iniciando...')

  await createConnection((socket) => {
    attachListener(socket)

    const stats = getStats()
    console.log(
      `📊 DB: ${stats.total} mensajes guardados, ${stats.unread} no leídos, ${stats.contacts} contactos`
    )
    console.log('👂 Escuchando mensajes entrantes. Ctrl+C para detener.\n')
  })
}

// Cierre limpio: no cortar mientras Baileys está guardando credenciales
process.on('SIGINT', () => {
  console.log('\n⏹  Cerrando ZEA WhatsApp...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  process.exit(0)
})

main().catch((err) => {
  console.error('Error fatal:', err)
  process.exit(1)
})
