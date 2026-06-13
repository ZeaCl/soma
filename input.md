# Prompt: Construir Lector de WhatsApp para ZEA Platform

## System Context

Soy Azort, CEO de ZEA Platform, consultora tecnológica chilena. Opero solo con Claude Code como multiplicador. Necesito leer mis mensajes de WhatsApp programáticamente para no perder conversaciones de clientes mientras estoy metido en desarrollo.

## El Problema

Cuando estoy en Claude Code desarrollando, no reviso WhatsApp ni mail. Se me pasan follow-ups, mensajes de clientes, y oportunidades. Necesito algo que corra en paralelo, lea mis mensajes, y me tenga todo listo para cuando salga de la cueva de código.

## Lo Que Quiero Construir

Un servicio mínimo que:
1. Se conecte a mi WhatsApp personal via WhatsApp Web (usando Baileys)
2. Lea mensajes entrantes en tiempo real
3. Los almacene/clasifique de forma básica
4. Me genere un resumen de pendientes cuando yo lo pida

## Restricciones Técnicas

- **Baileys** (https://github.com/WhiskeySockets/Baileys) como librería de conexión WhatsApp Web
- **Node.js/TypeScript** para el servicio
- **NO quiero usar servicios de terceros** tipo OpenClaw, Twilio, etc. — esto es mío, en mi máquina, por seguridad
- Los mensajes de mis clientes son confidenciales, todo debe ser local
- Debe correr en background mientras trabajo en otra cosa
- Conexión con mi número personal (selfChat mode o similar)

## Stack Disponible (ZEA Platform)

- **Elixir/OTP** — si tiene sentido para el orquestador/supervisor
- **Node.js/TypeScript** — para Baileys (es Node nativo)
- **Cortex** (mi AI gateway) — para procesar mensajes con LLMs cuando necesite resúmenes
- **Cerebellum** (mi orquestador de workflows) — para lógica de clasificación/ruteo
- **SQLite o PostgreSQL** — para almacenar mensajes
- **Power Automate** — si necesito conectar con mail/calendario

## Fase 1: MVP (Lo Mínimo)

Lo que necesito AHORA:
1. **Conectar Baileys** a mi WhatsApp, escanear QR, mantener sesión
2. **Capturar mensajes entrantes** (texto, audio metadata, imágenes metadata)
3. **Guardar en SQLite** con: remitente, timestamp, tipo, contenido, leído/no leído
4. **Script CLI simple** para ver resumen: "¿qué mensajes tengo pendientes?"

NO necesito en Fase 1:
- Responder automáticamente
- Transcribir audios
- Integración con IA
- UI bonita
- Deploy en cloud

## Fase 2: Integración con ZEA (Después)

- Conectar con Cortex para clasificar mensajes por cliente/urgencia
- Transcripción de audios con Whisper o similar
- Resúmenes automáticos diarios
- Drafts de respuesta sugeridos
- Integración con mail (leer Gmail/Outlook)
- Dashboard simple en Phoenix LiveView o web

## Consideraciones de Seguridad

- Las credenciales de WhatsApp (creds.json) deben estar protegidas
- Los mensajes se almacenan solo localmente
- No enviar contenido de mensajes a servicios externos sin mi autorización explícita
- El servicio debe poder detenerse limpiamente sin perder la sesión de WhatsApp

## Lo Que Espero del Asistente

1. Guíame paso a paso para construir la Fase 1
2. Dame el código funcional, no pseudocódigo
3. Usa TypeScript
4. Estructura el proyecto limpio desde el inicio (que después pueda crecer a Fase 2)
5. Explícame las limitaciones de Baileys y los riesgos (¿me pueden banear? ¿cómo mitigar?)
6. Dame el comando para correrlo y probarlo

## Estructura Esperada del Proyecto

```
zea-whatsapp/
├── src/
│   ├── connection.ts    # Baileys connection + auth
│   ├── listener.ts      # Message handler
│   ├── store.ts         # SQLite storage
│   ├── cli.ts           # CLI para consultar pendientes
│   └── index.ts         # Entry point
├── data/
│   ├── auth/            # Baileys credentials (gitignored)
│   └── messages.db      # SQLite
├── package.json
├── tsconfig.json
└── .gitignore
```

## Preguntas Que El Asistente Debe Responder Antes de Codear

1. ¿Baileys sigue activo y mantenido? ¿Qué fork usar?
2. ¿Riesgo real de ban por Meta? ¿Cómo minimizarlo?
3. ¿Puedo leer mensajes de grupos o solo DMs?
4. ¿Puedo recibir audios/imágenes o solo metadata?
5. ¿La sesión persiste si reinicio el servicio?
6. ¿Hay rate limits que deba respetar?

---

*Este proyecto es parte de la automatización interna de ZEA Platform. Si funciona bien, se integra con Cerebellum (orquestador) y Cortex (AI gateway) para procesamiento inteligente de mensajes.*