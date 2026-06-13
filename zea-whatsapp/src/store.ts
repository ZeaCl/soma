import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'messages.db')

// Asegurar que el directorio data/ existe
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)

// WAL mode para mejor performance con escrituras concurrentes
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    jid             TEXT NOT NULL,
    sender          TEXT NOT NULL,
    sender_name     TEXT,
    type            TEXT NOT NULL,
    content         TEXT,
    timestamp       INTEGER NOT NULL,
    is_group        INTEGER NOT NULL DEFAULT 0,
    group_name      TEXT,
    is_read         INTEGER NOT NULL DEFAULT 0,
    urgency         TEXT,
    category        TEXT,
    classified_at   INTEGER,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_messages_jid       ON messages(jid);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_is_read   ON messages(is_read);
`)

// Migración: agregar columnas de clasificación si la tabla ya existe sin ellas
const cols = (db.prepare(`PRAGMA table_info(messages)`).all() as any[]).map((c: any) => c.name)
if (!cols.includes('urgency')) {
  db.exec(`ALTER TABLE messages ADD COLUMN urgency TEXT`)
  db.exec(`ALTER TABLE messages ADD COLUMN category TEXT`)
  db.exec(`ALTER TABLE messages ADD COLUMN classified_at INTEGER`)
}
// El índice de urgency siempre lo creamos aquí para que funcione tanto en tabla nueva como migrada
db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_urgency ON messages(urgency)`)

export interface StoredMessage {
  id: string
  jid: string
  sender: string
  sender_name: string | null
  type: string
  content: string | null
  timestamp: number
  is_group: boolean
  group_name: string | null
  is_read: boolean
  urgency: string | null
  category: string | null
}

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO messages
    (id, jid, sender, sender_name, type, content, timestamp, is_group, group_name)
  VALUES
    (@id, @jid, @sender, @sender_name, @type, @content, @timestamp, @is_group, @group_name)
`)

export function saveMessage(msg: Omit<StoredMessage, 'is_read' | 'urgency' | 'category'>): boolean {
  const info = insertStmt.run({
    ...msg,
    is_group: msg.is_group ? 1 : 0,
  })
  return info.changes > 0
}

export function markAsRead(id: string): void {
  db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(id)
}

export function getUnread(): StoredMessage[] {
  const rows = db
    .prepare(
      `SELECT * FROM messages
       WHERE is_read = 0
       ORDER BY timestamp DESC`
    )
    .all() as any[]

  return rows.map(normalize)
}

export function getRecent(limit = 50): StoredMessage[] {
  const rows = db
    .prepare(
      `SELECT * FROM messages
       ORDER BY timestamp DESC
       LIMIT ?`
    )
    .all(limit) as any[]

  return rows.map(normalize)
}

export function getStats(): { total: number; unread: number; contacts: number } {
  const total = (db.prepare('SELECT COUNT(*) as n FROM messages').get() as any).n
  const unread = (db.prepare('SELECT COUNT(*) as n FROM messages WHERE is_read = 0').get() as any).n
  const contacts = (db.prepare('SELECT COUNT(DISTINCT jid) as n FROM messages').get() as any).n
  return { total, unread, contacts }
}

export function updateClassification(id: string, urgency: string, category: string): void {
  db.prepare(
    `UPDATE messages SET urgency = ?, category = ?, classified_at = unixepoch() WHERE id = ?`
  ).run(urgency, category, id)
}

function normalize(row: any): StoredMessage {
  return {
    ...row,
    is_group: row.is_group === 1,
    is_read: row.is_read === 1,
  }
}

