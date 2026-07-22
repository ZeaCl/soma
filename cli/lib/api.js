import { getToken, getBaseUrl } from './auth.js';

/**
 * Cliente HTTP compartido para todos los comandos.
 * Usa fetch() nativo (Node 18+).
 */
export async function api(method, path, { body, token, baseUrl, raw } = {}) {
  const t = token || getToken(process.argv.slice(2));
  const base = baseUrl || getBaseUrl(process.argv.slice(2));

  // path puede ser absoluto (/health) o relativo a /api
  const urlPath = path.startsWith('/api') || path.startsWith('/health') ? path : `/api${path}`;
  const url = new URL(urlPath, base);

  const headers = { 'Content-Type': 'application/json' };
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (raw) return res;

  const text = await res.text();

  // Intentar parsear JSON aunque el Content-Type no lo indique
  try {
    const data = JSON.parse(text);
    return { status: res.status, body: data };
  } catch {
    return { status: res.status, body: text };
  }
}

// Shorthands
export const get = (path, opts) => api('GET', path, opts);
export const post = (path, body, opts) => api('POST', path, { ...opts, body });
export const put = (path, body, opts) => api('PUT', path, { ...opts, body });
export const del = (path, opts) => api('DELETE', path, opts);

/**
 * Formatea un tamaño en bytes a string legible
 */
export function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Imprime tabla simple alineada
 */
export function printTable(headers, rows) {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] || '').length))
  );

  const sep = '  ';
  const header = headers.map((h, i) => h.padEnd(colWidths[i])).join(sep);
  console.log('  ' + header);
  console.log('  ' + '─'.repeat(header.length));

  for (const row of rows) {
    const line = row.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join(sep);
    console.log('  ' + line);
  }
}
