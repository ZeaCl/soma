import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.config', 'zea', 'config.json');

/**
 * Lee la configuración completa de ZEA desde ~/.config/zea/config.json
 */
export function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Obtiene el token de acceso, en orden de prioridad:
 * 1. Flag --token en args
 * 2. Variable de entorno ZEA_TOKEN
 * 3. Config file ~/.config/zea/config.json
 */
export function getToken(args = []) {
  const flagIdx = args.indexOf('--token');
  if (flagIdx >= 0 && args[flagIdx + 1]) return args[flagIdx + 1];

  if (process.env.ZEA_TOKEN) return process.env.ZEA_TOKEN;

  const config = getConfig();
  return config.token || config.accessToken || '';
}

/**
 * Deriva la URL base de Soma desde la configuración de entorno.
 * Prioridad:
 * 1. Flag --base-url en args
 * 2. Variable de entorno SOMA_URL
 * 3. Config file (ajusta subdominio auth → soma)
 * 4. Default: http://soma.zea.localhost
 */
export function getBaseUrl(args = []) {
  const flagIdx = args.indexOf('--base-url');
  if (flagIdx >= 0 && args[flagIdx + 1]) return args[flagIdx + 1];

  if (process.env.SOMA_URL) return process.env.SOMA_URL;

  const config = getConfig();
  if (config.apiUrl) {
    // auth.zea.localhost → soma.zea.localhost, auth.zea.cl → soma.zea.cl
    return config.apiUrl.replace(/auth\.zea/, 'soma.zea');
  }

  return 'http://soma.zea.localhost';
}

/**
 * Obtiene el organization ID desde el config
 */
export function getOrgId() {
  const config = getConfig();
  return config.orgId || process.env.ZEA_ORG_ID || '';
}

/**
 * Muestra la ruta del archivo de configuración
 */
export function getConfigPath() {
  return CONFIG_PATH;
}
