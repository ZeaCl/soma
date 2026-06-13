import { cortexChat } from './cortex'
import { updateClassification } from './store'

export type Urgency = 'alta' | 'media' | 'baja'
export type Category = 'consulta' | 'seguimiento' | 'problema' | 'info' | 'otro'

export interface Classification {
  urgency: Urgency
  category: Category
}

const SYSTEM_PROMPT = `Eres un asistente de clasificación de mensajes de WhatsApp para ZEA Platform, una consultora tecnológica.
Clasifica cada mensaje en dos dimensiones:

URGENCIA:
- alta: requiere respuesta inmediata (problema urgente, cliente bloqueado, contrato en riesgo)
- media: requiere respuesta hoy o mañana (consulta importante, seguimiento pendiente)
- baja: puede esperar (info general, saludo, agradecimiento)

CATEGORÍA:
- consulta: pregunta o solicitud de información
- seguimiento: seguimiento de algo ya en curso
- problema: reporta un error, fallo o inconveniente
- info: comparte información sin esperar respuesta
- otro: no encaja en las anteriores

Responde ÚNICAMENTE con JSON válido, sin explicaciones:
{"urgency":"alta|media|baja","category":"consulta|seguimiento|problema|info|otro"}`

export async function classifyMessage(msgId: string, sender: string, content: string): Promise<void> {
  try {
    const response = await cortexChat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `De: ${sender}\nMensaje: ${content}` },
    ])

    const parsed = JSON.parse(response.trim()) as Classification

    const validUrgencies = new Set(['alta', 'media', 'baja'])
    const validCategories = new Set(['consulta', 'seguimiento', 'problema', 'info', 'otro'])

    if (!validUrgencies.has(parsed.urgency) || !validCategories.has(parsed.category)) {
      throw new Error(`Clasificación inválida: ${response}`)
    }

    updateClassification(msgId, parsed.urgency, parsed.category)

    const urgencyEmoji = { alta: '🔴', media: '🟡', baja: '🟢' }[parsed.urgency]
    console.log(`🏷️  ${urgencyEmoji} ${parsed.urgency.toUpperCase()} | ${parsed.category} → msg ${msgId.slice(-6)}`)
  } catch (err) {
    // Clasificación no-crítica: loguear pero no interrumpir el flujo
    console.error(`⚠️  Clasificación fallida para ${msgId}: ${(err as Error).message}`)
  }
}
