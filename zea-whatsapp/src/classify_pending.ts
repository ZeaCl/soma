// Script one-shot: clasifica mensajes de texto pendientes sin clasificar
import { classifyMessage } from './classifier'
import { getUnread } from './store'

async function main() {
  const msgs = getUnread().filter(m => m.type === 'text' && m.content && !m.urgency)
  if (msgs.length === 0) {
    console.log('No hay mensajes de texto pendientes de clasificar.')
    return
  }
  console.log(`Clasificando ${msgs.length} mensaje(s)...`)
  for (const m of msgs) {
    await classifyMessage(m.id, m.sender_name ?? m.sender, m.content!)
  }
}

main().catch(console.error)
