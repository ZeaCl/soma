#!/usr/bin/env node
/**
 * API → CLI Coverage Check
 *
 * Extrae todas las rutas REST del api_controller.ex y verifica
 * qué porcentaje está cubierto por comandos de la CLI.
 *
 * Uso: node cli/scripts/check-coverage.js
 *
 * Exit 0 si coverage >= threshold, exit 1 si no.
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const THRESHOLD = process.env.CLI_COVERAGE_THRESHOLD
  ? parseInt(process.env.CLI_COVERAGE_THRESHOLD)
  : 70; // porcentaje mínimo

// ── 1. Extraer rutas de la API ─────────────────────────────────────────────

function extractApiRoutes() {
  const controllerPath = join(ROOT, 'lib', 'soma_web', 'controllers', 'api_controller.ex');
  const source = readFileSync(controllerPath, 'utf8');

  const routes = [];
  const methodPattern = /\b(get|post|put|delete|patch)\s+"([^"]+)"/g;
  let match;

  while ((match = methodPattern.exec(source)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];

    // Saltar el catch-all
    if (path === '_') continue;

    // Normalizar path: quitar parámetros dinámicos
    const normalized = path.replace(/\/:[^/]+/g, '/:id');

    routes.push({ method, path, normalized });
  }

  // También rutas del router principal (no solo api_controller)
  const routerPath = join(ROOT, 'lib', 'soma_web', 'router.ex');
  try {
    const routerSource = readFileSync(routerPath, 'utf8');
    const routerPattern = /\b(get|post|put|delete)\s+"([^"]+)"/g;
    while ((match = routerPattern.exec(routerSource)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      if (path === '/' || path === '_' || path.startsWith('/api')) continue;
      const normalized = path.replace(/\/:[^/]+/g, '/:id');
      // Solo agregar si es ruta de API o health
      if (path === '/health' || path === '/agent-ws') {
        routes.push({ method, path, normalized });
      }
    }
  } catch {}

  // Agregar WebSocket explícitamente
  routes.push({ method: 'WS', path: '/agent-ws', normalized: '/agent-ws' });

  return routes;
}

// ── 2. Extraer comandos de la CLI ─────────────────────────────────────────

function extractCliCommands() {
  try {
    const output = execSync('node cli/index.js --zea-discover', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 5000,
    });
    const discover = JSON.parse(output);
    return Object.keys(discover.commands || {});
  } catch (err) {
    console.error('❌ No se pudo extraer comandos de la CLI:', err.message);
    console.error('   Asegurate de que "node cli/index.js --zea-discover" funcione');
    process.exit(1);
  }
}

// ── 3. Mapeo API → CLI ────────────────────────────────────────────────────

/**
 * Mapa de ruta API → comando(s) CLI que la cubren.
 *
 * Formato: 'METHOD /ruta/normalizada' → ['comando cli']
 *
 * Si un endpoint no está en este mapa, se reporta como uncovered.
 * Los comandos que cubren múltiples endpoints se listan para cada uno.
 */
const ROUTE_TO_CLI = {
  // Health
  'GET /health': ['health'],

  // Conversations
  'GET /conversations': ['conv list'],
  'GET /conversations/:id': ['conv show'],
  'POST /conversations/:id/messages': ['conv show'],    // implícito en show/chat
  'DELETE /conversations/:id': ['conv delete'],

  // Agents
  'GET /agents': ['agent list'],
  'GET /agents/:id': ['agent show'],
  'POST /agents': ['agent create'],
  'PUT /agents/:id/config': ['agent config'],
  'DELETE /agents/:id': ['agent delete'],
  'POST /agents/:id/share': ['agent share'],
  'DELETE /agents/:id/share/:user_id': ['agent share'],   // unshare dentro de share
  'GET /agents/:id/shares': ['agent share'],
  'GET /agent-shares': ['agent share'],
  'GET /agents/:id/skills': ['agent show'],

  // Skills
  'GET /skills': ['skill list'],
  'GET /skills/:name': ['skill show'],
  'POST /skills': ['skill create'],
  'PUT /skills/:name': ['skill edit'],
  'DELETE /skills/:name': ['skill delete'],
  'PUT /skills/:name/agents': ['skill assign'],

  // Sandboxes
  'GET /sandboxes': ['sandbox files'],
  'GET /sandboxes/create': ['sandbox create'],
  'DELETE /sandboxes/:id': ['sandbox destroy'],

  // Files (org workspace)
  'GET /files': ['files list'],
  'GET /files/content': ['files read'],
  'POST /files/upload': ['files upload'],
  'POST /files/mkdir': ['files mkdir'],
  'PUT /files/rename': ['files rename'],
  'POST /files/move': ['files move'],
  'DELETE /files': ['files delete'],
  'GET /files/history': ['files history'],
  'POST /files/recover': ['files recover'],
  'POST /files/push': ['files push'],

  // Files (unified)
  'GET /files/unified': ['files list', 'sandbox files'],
  'POST /files/unified/upload': ['files upload'],

  // API Keys
  'POST /api-keys': ['api-key create'],

  // WebSocket
  'WS /agent-ws': ['chat'],
  'GET /agent-ws': ['chat'],      // HTTP upgrade → WebSocket

  // Doctor (compuesto — cubre múltiples endpoints)
  // No mapea a un endpoint específico, es diagnóstico

  // user-sandbox (legacy — cubiertos por sandbox + files unificados)
  // No se definen en el controlador como rutas separadas, usan /sandboxes y /files/unified
};

// ── 4. Calcular cobertura ─────────────────────────────────────────────────

function checkCoverage(apiRoutes, cliCommands) {
  const covered = [];
  const uncovered = [];
  const cliSet = new Set(cliCommands);

  for (const route of apiRoutes) {
    const key = `${route.method} ${route.normalized}`;

    // Armar keys alternativas para pattern matching
    const altKeys = [];
    // También buscar sin parámetros dinámicos específicos
    if (route.path !== route.normalized) {
      altKeys.push(`${route.method} ${route.path}`);
    }

    const mapped = ROUTE_TO_CLI[key] || altKeys.flatMap(k => ROUTE_TO_CLI[k] || []);
    const uniqueMapped = [...new Set(mapped)];

    if (uniqueMapped.length > 0) {
      covered.push({ route: key, commands: uniqueMapped, covered: true });
    } else {
      uncovered.push({ route: key, commands: [], covered: false });
    }
  }

  // Report commands that don't map to any API route (extra CLI features)
  const coveredCmds = new Set(covered.flatMap(r => r.commands));
  const extraCmds = cliCommands.filter(c => !coveredCmds.has(c));

  return { covered, uncovered, extraCmds };
}

// ── 5. Report ──────────────────────────────────────────────────────────────

function report({ covered, uncovered, extraCmds }, apiRoutes) {
  const total = apiRoutes.length;
  const pct = Math.round((covered.length / total) * 100);

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`🔍 API → CLI Coverage: ${pct}% (${covered.length}/${total} endpoints)`);
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  if (uncovered.length > 0) {
    console.log(`❌ ${uncovered.length} endpoints SIN cobertura CLI:`);
    for (const r of uncovered) {
      console.log(`   ${r.route}`);
    }
    console.log('');
  }

  if (extraCmds.length > 0) {
    console.log(`✨ ${extraCmds.length} comandos extra (sin endpoint directo):`);
    for (const c of extraCmds) {
      console.log(`   ${c}`);
    }
    console.log('');
  }

  console.log(`📊 Coverage: ${pct}%  Threshold: ${THRESHOLD}%`);

  if (pct >= THRESHOLD) {
    console.log('✅ PASS');
    return 0;
  } else {
    console.log(`❌ FAIL — coverage ${pct}% < threshold ${THRESHOLD}%`);
    return 1;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

const apiRoutes = extractApiRoutes();
const cliCommands = extractCliCommands();
const result = checkCoverage(apiRoutes, cliCommands);
const exitCode = report(result, apiRoutes);

process.exit(exitCode);
