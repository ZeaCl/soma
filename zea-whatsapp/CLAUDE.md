# ZEA WhatsApp — Contexto del Proyecto

## Qué es esto
Servicio local de lectura de WhatsApp para Azort (CEO ZEA Platform). Corre en background mientras trabaja en Claude Code. No usa servicios externos — todo local por seguridad y confidencialidad de clientes.

## Stack
- **Baileys** (`@whiskeysockets/baileys`) — conexión WhatsApp Web
- **TypeScript + Node.js** — runtime
- **better-sqlite3** — almacenamiento local (WAL mode)
- **ts-node** — ejecución en desarrollo (CommonJS, no ESM)

## Comandos
```bash
npm run dev              # Arranca el servicio (primera vez pide QR)
npm run pending          # Resumen de mensajes no leídos
npm run pending -- --all    # Todos los mensajes
npm run pending -- --mark   # Muestra y marca como leídos
npm run pending -- --last 20  # Últimos N mensajes
```

## Estructura
```
src/
├── connection.ts   # Baileys auth + reconexión automática (3s backoff)
├── listener.ts     # Captura mensajes: texto, voz, imagen, video, doc, sticker...
├── store.ts        # SQLite: saveMessage, getUnread, getRecent, getStats, markAsRead
├── cli.ts          # CLI agrupado por contacto con flags --all --mark --last
└── index.ts        # Entry point + SIGINT limpio
data/
├── auth/           # Credenciales Baileys (gitignored) — persisten entre reinicios
└── messages.db     # SQLite (gitignored)
```

## Decisiones técnicas importantes
- Imports sin extensión `.js` — el proyecto usa CommonJS, no ESM. ts-node no resuelve `.js`.
- `syncFullHistory: false` — solo mensajes nuevos desde que arranca, no historial completo.
- `markOnlineOnConnect: false` — no aparece "en línea" automáticamente.
- WAL mode SQLite — lecturas concurrentes mientras el servicio escribe.
- Código 515 en reconexión — normal en Baileys al negociar sesión inicial, no es error.

## Estado actual
- Fase 1 MVP completa y funcionando
- Captura mensajes en tiempo real, los guarda en SQLite, CLI operativo

## Fase 2 (pendiente)
- Conectar **Cortex** (AI gateway) para clasificar mensajes por cliente/urgencia
- Transcripción de audios con Whisper
- Resúmenes automáticos diarios
- Drafts de respuesta sugeridos
- Dashboard Phoenix LiveView
- Integración mail (Gmail/Outlook via Power Automate)
