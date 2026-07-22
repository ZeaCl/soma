import { getClientOpts } from './client.js';
import { fetchWithTimeout } from './client.js';

/**
 * Cliente HTTP compartido para todos los comandos.
 */
export async function api(method, path, { body, token, baseUrl, raw, timeout } = {}) {
  const opts = getClientOpts();
  const t = token || opts.token;
  const base = baseUrl || opts.baseUrl;

  const urlPath = (path.startsWith('/api/') || path === '/api' || path.startsWith('/health')) ? path : `/api${path}`;
  const url = new URL(urlPath, base);

  const headers = { 'Content-Type': 'application/json' };
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const res = await fetchWithTimeout(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }, timeout || 30000);

  if (raw) return res;

  const text = await res.text();

  try {
    const data = JSON.parse(text);
    return { status: res.status, body: data };
  } catch {
    return { status: res.status, body: text };
  }
}

export const get = (path, opts) => api('GET', path, opts);
export const post = (path, body, opts) => api('POST', path, { ...opts, body });
export const put = (path, body, opts) => api('PUT', path, { ...opts, body });
export const del = (path, opts) => api('DELETE', path, opts);

export function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

/**
 * Devuelve true si la CLI debe output JSON en vez de formato tabulado.
 */
let _jsonMode = null;
export function isJsonMode() {
  if (_jsonMode !== null) return _jsonMode;
  _jsonMode = process.argv.includes('--json');
  return _jsonMode;
}

export function output(data) {
  if (isJsonMode()) {
    console.log(JSON.stringify(data, null, 2));
  }
}
