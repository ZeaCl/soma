import { getToken, getBaseUrl } from './auth.js';

/**
 * Resuelve opciones de cliente una sola vez.
 * Prioridad: 1) commander global opts, 2) env vars, 3) config file
 */
export function getClientOpts(programOpts = {}) {
  const args = process.argv.slice(2);
  return {
    token: programOpts.token || getToken(args),
    baseUrl: programOpts.baseUrl || getBaseUrl(args),
  };
}

/**
 * fetch con timeout vía AbortController
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
