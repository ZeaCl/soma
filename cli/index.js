#!/usr/bin/env node
/**
 * zea-soma — CLI for ZEA Soma AgentHub
 *
 * Integrado al router zea-cli vía Dynamic PATH Discovery.
 * Soporta --zea-discover para metadata.
 */

import { Command } from 'commander';
import chalk from 'chalk';

import { getToken, getBaseUrl, getConfigPath } from './lib/auth.js';
import { get, post, put, del, formatSize, printTable } from './lib/api.js';

// ── Dynamic Discovery ──────────────────────────────────────────────────────

const DISCOVER_METADATA = {
  description: 'AgentHub e interacción con IAs',
  commands: {
    'agent list': 'Lista agentes disponibles',
    'agent show': 'Muestra detalle de un agente',
    'agent create': 'Crea un nuevo agente con sandbox',
    'agent config': 'Actualiza configuración de un agente',
    'agent delete': 'Elimina un agente',
    'agent share': 'Comparte un agente con otro usuario',
    'skill list': 'Lista skills disponibles',
    'skill show': 'Muestra contenido de un skill',
    'skill create': 'Crea un skill custom',
    'skill edit': 'Edita un skill existente',
    'skill delete': 'Elimina un skill',
    'skill assign': 'Asigna un skill a agentes',
    'conv list': 'Lista conversaciones',
    'conv show': 'Muestra mensajes de una conversación',
    'conv delete': 'Elimina una conversación',
    'chat': 'Chat interactivo WebSocket con un agente',
    'sandbox create': 'Crea un sandbox (usuario o agente)',
    'sandbox destroy': 'Destruye un sandbox',
    'sandbox files': 'Lista archivos de un sandbox',
    'files list': 'Lista archivos unificados',
    'files upload': 'Sube un archivo al workspace',
    'files read': 'Lee el contenido de un archivo',
    'files delete': 'Elimina un archivo',
    'files mkdir': 'Crea un directorio',
    'files rename': 'Renombra un archivo',
    'files move': 'Mueve un archivo',
    'files history': 'Muestra el historial git de un archivo',
    'files recover': 'Recupera una versión anterior de un archivo',
    'files push': 'Hace git push del workspace',
    'api-key create': 'Crea una API key',
    'health': 'Verifica que Soma esté funcionando',
    'doctor': 'Diagnóstico completo de Soma',
  },
};

// Detectar --zea-discover ANTES de que commander lo procese
if (process.argv.includes('--zea-discover')) {
  console.log(JSON.stringify(DISCOVER_METADATA, null, 2));
  process.exit(0);
}

// ── Commander Program ──────────────────────────────────────────────────────

const program = new Command();

program
  .name('zea-soma')
  .description('ZEA Soma AgentHub — gestión de agentes, skills, sandboxes y chat')
  .version('0.2.0')
  .option('--token <token>', 'Bearer token (o usar ZEA_TOKEN env var)')
  .option('--base-url <url>', 'Soma API URL (default: http://soma.zea.localhost)');

// ── health ─────────────────────────────────────────────────────────────────

program
  .command('health')
  .description('Verifica que Soma esté funcionando')
  .action(async () => {
    try {
      const { status, body } = await get('/health');
      if (status === 200) {
        console.log(chalk.green('✅ Soma AgentHub'));
        console.log(`   Status: ${chalk.green(body.status)}`);
        console.log(`   Service: ${body.service}`);
      } else {
        console.log(chalk.red(`❌ Soma no responde (HTTP ${status})`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ No se pudo conectar: ${err.message}`));
      process.exit(1);
    }
  });

// ── agent ──────────────────────────────────────────────────────────────────

const agentCmd = program
  .command('agent')
  .description('Gestión de agentes IA');

agentCmd
  .command('list')
  .description('Lista agentes disponibles')
  .action(async () => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await get('/agents', { token });
      if (status === 200 && body.data) {
        if (body.data.length === 0) {
          console.log(chalk.dim('  No hay agentes disponibles'));
          return;
        }
        const rows = body.data.map(a => [
          a.id?.slice(0, 8) || '—',
          a.name || a.email || '—',
          (a.agent_config?.engine) || 'pi',
          (a.agent_config?.skills || []).join(', ') || '—',
          a.is_agent ? '🟢' : '👤',
        ]);
        printTable(['ID', 'Nombre', 'Engine', 'Skills', 'Tipo'], rows);
        console.log(`\n  Total: ${body.data.length} agente(s)`);
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

agentCmd
  .command('show <id>')
  .description('Muestra detalle de un agente')
  .action(async (id) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await get(`/agents/${id}`, { token });
      if (status === 200 && body.data) {
        const a = body.data;
        const cfg = a.agent_config || {};
        console.log(chalk.cyan(`\n🤖 ${a.name || a.email || a.id}`));
        console.log(`   ID:     ${a.id}`);
        console.log(`   Email:  ${a.email || '—'}`);
        console.log(`   Engine: ${cfg.engine || 'pi'}`);
        console.log(`   Model:  ${cfg.model || '(default)'}`);
        console.log(`   Skills: ${(cfg.skills || []).join(', ') || '(ninguna)'}`);
        if (cfg.system_prompt) {
          console.log(`\n   ${chalk.dim('System Prompt:')}`);
          console.log(`   ${cfg.system_prompt.slice(0, 200)}${cfg.system_prompt.length > 200 ? '...' : ''}`);
        }
      } else {
        console.log(chalk.red(`❌ Agente no encontrado`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

agentCmd
  .command('create')
  .description('Crea un nuevo agente con sandbox')
  .option('--name <name>', 'Nombre del agente')
  .option('--email <email>', 'Email del agente')
  .option('--system-prompt <text>', 'System prompt')
  .option('--skills <list>', 'Skills separadas por coma')
  .option('--engine <engine>', 'Engine (pi, react, opencode)', 'pi')
  .option('--model <model>', 'Modelo LLM')
  .action(async (opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const skills = opts.skills ? opts.skills.split(',').map(s => s.trim()) : [];
      const body = {
        name: opts.name,
        email: opts.email,
        is_agent: true,
        agent_config: {
          engine: opts.engine,
          model: opts.model,
          system_prompt: opts.systemPrompt,
          skills,
        },
      };
      console.log(chalk.cyan('🆕 Creando agente...'));
      const { status, body: data } = await post('/agents', body, { token });
      if (status === 201) {
        console.log(chalk.green(`✅ Agente creado: ${data.data?.id || data.data?.name}`));
        if (skills.length) console.log(`   Skills: ${skills.join(', ')}`);
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status}): ${data.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

agentCmd
  .command('config <id>')
  .description('Actualiza configuración de un agente')
  .option('--system-prompt <text>', 'Nuevo system prompt')
  .option('--model <model>', 'Nuevo modelo LLM')
  .option('--skills <list>', 'Nuevas skills (coma separadas)')
  .action(async (id, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const config = {};
      if (opts.systemPrompt) config.system_prompt = opts.systemPrompt;
      if (opts.model) config.model = opts.model;
      if (opts.skills) config.skills = opts.skills.split(',').map(s => s.trim());

      const { status, body } = await put(`/agents/${id}/config`, config, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Configuración actualizada para ${id.slice(0, 8)}...`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

agentCmd
  .command('delete <id>')
  .description('Elimina un agente')
  .action(async (id) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status } = await del(`/agents/${id}`, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Agente eliminado: ${id.slice(0, 8)}...`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status})`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

agentCmd
  .command('share <id>')
  .description('Comparte un agente con otro usuario')
  .requiredOption('--with <user-id>', 'ID del usuario con quien compartir')
  .action(async (id, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await post(`/agents/${id}/share`, { shared_with_user_id: opts.with }, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Agente compartido con ${opts.with.slice(0, 8)}...`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

agentCmd
  .command('unshare <id>')
  .description('Deja de compartir un agente')
  .requiredOption('--user <user-id>', 'ID del usuario')
  .action(async (id, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status } = await del(`/agents/${id}/share/${opts.user}`, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Agente descompartido`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status})`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

agentCmd
  .command('shares <id>')
  .description('Lista con quién está compartido un agente')
  .action(async (id) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await get(`/agents/${id}/shares`, { token });
      if (status === 200 && body.data) {
        if (body.data.length === 0) {
          console.log(chalk.dim('  No compartido con nadie'));
          return;
        }
        for (const s of body.data) {
          console.log(`  👤 ${s.shared_with_user_id?.slice(0, 8)}... (por ${s.shared_by_user_id?.slice(0, 8)}...)`);
        }
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

// ── skill ──────────────────────────────────────────────────────────────────

const skillCmd = program
  .command('skill')
  .description('Gestión de skills');

skillCmd
  .command('list')
  .description('Lista skills disponibles')
  .action(async () => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await get('/skills', { token });
      if (status === 200 && body.data) {
        if (body.data.length === 0) {
          console.log(chalk.dim('  No hay skills disponibles'));
          return;
        }
        const rows = body.data.map(s => [s.name, s.source || 'custom', s.description || '—']);
        printTable(['Nombre', 'Origen', 'Descripción'], rows);
        console.log(`\n  Total: ${body.data.length} skill(s)`);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

skillCmd
  .command('show <name>')
  .description('Muestra contenido de un skill')
  .action(async (name) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await get(`/skills/${name}`, { token });
      if (status === 200) {
        console.log(chalk.cyan(`\n📋 ${body.name} (${body.source || 'custom'})`));
        console.log('─'.repeat(60));
        console.log(body.content);
        console.log('─'.repeat(60));
      } else {
        console.log(chalk.red(`❌ Skill no encontrado`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

skillCmd
  .command('create')
  .description('Crea un skill nuevo')
  .requiredOption('--name <name>', 'Nombre del skill')
  .requiredOption('--file <path>', 'Archivo markdown del skill')
  .action(async (opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const fs = await import('fs');
      const content = fs.readFileSync(opts.file, 'utf8');
      const { status, body } = await post('/skills', { name: opts.name, content }, { token });
      if (status === 201) {
        console.log(chalk.green(`✅ Skill creado: ${opts.name}`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

skillCmd
  .command('edit <name>')
  .description('Edita un skill existente')
  .requiredOption('--file <path>', 'Nuevo archivo markdown')
  .action(async (name, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const fs = await import('fs');
      const content = fs.readFileSync(opts.file, 'utf8');
      const { status, body } = await put(`/skills/${name}`, { content }, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Skill actualizado: ${name}`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

skillCmd
  .command('delete <name>')
  .description('Elimina un skill')
  .action(async (name) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status } = await del(`/skills/${name}`, { token });
      if (status === 204 || status === 200) {
        console.log(chalk.green(`✅ Skill eliminado: ${name}`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status})`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

skillCmd
  .command('assign <name>')
  .description('Asigna un skill a agentes')
  .requiredOption('--agents <list>', 'IDs de agentes separados por coma')
  .action(async (name, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const agentIds = opts.agents.split(',').map(s => s.trim());
      const { status, body } = await put(`/skills/${name}/agents`, { agentIds }, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Skill '${name}' asignado a ${agentIds.length} agente(s)`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

// ── conv ───────────────────────────────────────────────────────────────────

const convCmd = program
  .command('conv')
  .description('Gestión de conversaciones');

convCmd
  .command('list')
  .description('Lista conversaciones')
  .action(async () => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await get('/conversations', { token });
      if (status === 200 && body.data) {
        if (body.data.length === 0) {
          console.log(chalk.dim('  No hay conversaciones'));
          return;
        }
        const rows = body.data.map(c => [
          c.id?.slice(0, 12) || '—',
          c.title || c.agent_id?.slice(0, 8) || '—',
          String(c.message_count || 0),
          c.last_message_at?.slice(0, 16) || '—',
        ]);
        printTable(['ID', 'Agente', 'Msgs', 'Último mensaje'], rows);
        console.log(`\n  Total: ${body.total || body.data.length} conversación(es)`);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

convCmd
  .command('show <id>')
  .description('Muestra mensajes de una conversación')
  .action(async (id) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await get(`/conversations/${id}`, { token });
      if (status === 200) {
        console.log(chalk.cyan(`\n💬 Conversación: ${body.id?.slice(0, 12)}...`));
        console.log(`   Título: ${body.title || '(sin título)'}`);
        console.log(`   Mensajes: ${body.messages?.length || 0}`);
        console.log('─'.repeat(60));
        for (const m of (body.messages || [])) {
          const roleIcon = m.role === 'user' ? '👤' : '🤖';
          console.log(`\n${roleIcon} ${chalk.bold(m.role)} — ${m.timestamp?.slice(0, 16) || ''}`);
          if (m.thinking) {
            console.log(chalk.dim(`   🧠 ${m.thinking.slice(0, 120)}${m.thinking.length > 120 ? '...' : ''}`));
          }
          console.log(`   ${m.content?.slice(0, 300) || '(sin contenido)'}${(m.content?.length || 0) > 300 ? '...' : ''}`);
        }
        console.log('\n─'.repeat(60));
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

convCmd
  .command('delete <id>')
  .description('Elimina una conversación')
  .action(async (id) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status } = await del(`/conversations/${id}`, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Conversación eliminada`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status})`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

// ── chat ───────────────────────────────────────────────────────────────────

program
  .command('chat <agent-id>')
  .description('Chat interactivo WebSocket con un agente')
  .option('-p, --prompt <text>', 'Prompt one-shot (sin modo interactivo)')
  .option('--continue <conv-id>', 'ID de conversación a continuar')
  .action(async (agentId, opts) => {
    await runChat(agentId, opts);
  });

async function runChat(agentId, opts) {
  const token = getToken(process.argv.slice(2));
  const baseUrl = getBaseUrl(process.argv.slice(2));
  const convId = opts.continue || `cli-${Date.now()}`;

  // Dynamic import ws
  const { default: WebSocket } = await import('ws');

  const wsUrl = baseUrl
    .replace(/^http/, 'ws')
    .replace(/\/$/, '') + '/agent-ws';

  console.log(chalk.cyan(`\n🧠 Conectando con ${agentId.slice(0, 8)}...`));

  const ws = new WebSocket(wsUrl);
  let ready = false;
  let streaming = false;

  const pendingPrompt = opts.prompt || null;

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'init', uid: agentId, cid: convId, token }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'ready':
          ready = true;
          console.log(chalk.green('✅ Listo'));
          if (pendingPrompt) {
            ws.send(JSON.stringify({ type: 'prompt', text: pendingPrompt }));
          } else if (!opts.prompt) {
            startInteractive(ws);
          }
          break;

        case 'thinking_start':
          streaming = true;
          process.stdout.write(chalk.dim('🧠 '));
          break;

        case 'thinking':
          process.stdout.write(chalk.dim('.'));
          break;

        case 'thinking_end':
          console.log('');
          break;

        case 'delta':
          process.stdout.write(msg.text);
          break;

        case 'tool':
          console.log(chalk.cyan(`\n🔧 ${msg.name}`) + chalk.dim(` ${JSON.stringify(msg.input).slice(0, 80)}`));
          break;

        case 'tool_result':
          console.log(chalk.dim(`   → ${(msg.content || '').slice(0, 120)}`));
          break;

        case 'done':
          streaming = false;
          console.log('');
          if (opts.prompt) {
            ws.close();
          } else {
            promptUser(ws);
          }
          break;

        case 'cancelled':
          streaming = false;
          console.log(chalk.yellow('\n⏹️  Cancelado'));
          promptUser(ws);
          break;

        case 'error':
          console.log(chalk.red(`\n❌ ${msg.message}`));
          ws.close();
          break;
      }
    } catch {
      // ignore parse errors
    }
  });

  ws.on('error', (err) => {
    console.log(chalk.red(`\n❌ Error de conexión: ${err.message}`));
    process.exit(1);
  });

  ws.on('close', () => {
    if (!opts.prompt) {
      console.log(chalk.dim('\n👋 Chau!'));
    }
    process.exit(0);
  });
}

function startInteractive(ws) {
  process.stdout.write('\n');
  promptUser(ws);
}

function promptUser(ws) {
  process.stdout.write(chalk.green('▸ '));
}

// ── sandbox ────────────────────────────────────────────────────────────────

const sandboxCmd = program
  .command('sandbox')
  .description('Gestión de sandboxes (usuarios y agentes)');

sandboxCmd
  .command('create <id>')
  .description('Crea un sandbox')
  .requiredOption('--org <org-id>', 'Organization ID')
  .option('--type <type>', 'user o agent', 'user')
  .option('--teams <teams>', 'Teams separados por coma')
  .action(async (id, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const params = new URLSearchParams({ type: opts.type, user_id: id, org_id: opts.org });
      if (opts.teams) params.set('teams', opts.teams);
      console.log(chalk.cyan(`👤 Creando sandbox ${opts.type} para ${id.slice(0, 8)}...`));
      const baseUrl = getBaseUrl(process.argv.slice(2));
      const res = await fetch(`${baseUrl}/api/sandboxes/create?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      if (res.status === 201) {
        console.log(chalk.green(`✅ Creado: ${body.username}`));
        console.log(`   Home: ${body.home}`);
        console.log(`   UID:  ${body.uid}`);
      } else {
        console.log(chalk.red(`❌ Error (${res.status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

sandboxCmd
  .command('destroy <id>')
  .description('Destruye un sandbox')
  .option('--type <type>', 'user o agent', 'user')
  .action(async (id, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status } = await del(`/sandboxes/${id}?type=${opts.type}`, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Sandbox destruido: ${id.slice(0, 8)}...`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status})`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

sandboxCmd
  .command('files <id>')
  .description('Lista archivos de un sandbox')
  .option('--type <type>', 'user o agent', 'user')
  .option('--path <path>', 'Subdirectorio')
  .action(async (id, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const params = new URLSearchParams({ owner_type: opts.type, owner_id: id });
      if (opts.path) params.set('path', opts.path);
      const { status, body } = await get(`/files/unified?${params}`, { token });
      if (status === 200 && body.files) {
        if (body.files.length === 0) {
          console.log(chalk.dim(`  📭 Sin archivos`));
          return;
        }
        console.log(chalk.cyan(`📁 Archivos de ${id.slice(0, 8)}...${opts.path ? '/' + opts.path : ''}:`));
        for (const f of body.files) {
          const icon = f.type === 'dir' ? '📁' : '📄';
          console.log(`   ${icon} ${f.name.padEnd(40)} ${formatSize(f.size)}`);
        }
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

// ── files ──────────────────────────────────────────────────────────────────

const filesCmd = program
  .command('files')
  .description('Gestión de archivos de workspace');

filesCmd
  .command('list')
  .description('Lista archivos')
  .option('--agent <id>', 'Filtrar por agente')
  .option('--user <id>', 'Filtrar por usuario')
  .option('--org <id>', 'Filtrar por organización')
  .option('--path <path>', 'Subdirectorio')
  .action(async (opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const ownerType = opts.agent ? 'agent' : opts.user ? 'user' : 'org';
      const ownerId = opts.agent || opts.user || '';
      const orgId = opts.org || '';
      const params = new URLSearchParams({ owner_type: ownerType });
      if (ownerId) params.set('owner_id', ownerId);
      if (orgId) params.set('org_id', orgId);
      if (opts.path) params.set('path', opts.path);
      const { status, body } = await get(`/files/unified?${params}`, { token });
      if (status === 200 && body.files) {
        if (body.files.length === 0) {
          console.log(chalk.dim('  📭 Sin archivos'));
          return;
        }
        for (const f of body.files) {
          const icon = f.type === 'dir' ? '📁' : '📄';
          console.log(`   ${icon} ${f.name.padEnd(40)} ${formatSize(f.size)}`);
        }
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

filesCmd
  .command('upload <local-file>')
  .description('Sube un archivo al workspace')
  .option('--agent <id>', 'Dueño agente')
  .option('--user <id>', 'Dueño usuario')
  .option('--path <path>', 'Directorio remoto')
  .action(async (localFile, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const fs = await import('fs');
      const path = await import('path');
      if (!fs.existsSync(localFile)) {
        console.log(chalk.red(`❌ Archivo no encontrado: ${localFile}`));
        process.exit(1);
      }
      const fileName = path.basename(localFile);
      const fileData = fs.readFileSync(localFile);
      const base64Data = fileData.toString('base64');
      const ownerType = opts.agent ? 'agent' : 'user';
      const ownerId = opts.agent || opts.user;

      console.log(chalk.cyan(`📤 Subiendo ${fileName} (${formatSize(fileData.length)})...`));
      const { status, body } = await post('/files/unified/upload', {
        owner_type: ownerType,
        owner_id: ownerId,
        name: fileName,
        data: base64Data,
        path: opts.path || undefined,
      }, { token });
      if (status === 200 && body.ok) {
        console.log(chalk.green(`✅ ${body.path} (${formatSize(body.size)})`));
      } else {
        console.log(chalk.red(`❌ Error (${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

filesCmd
  .command('read <path>')
  .description('Lee el contenido de un archivo')
  .action(async (filePath) => {
    try {
      const token = getToken(process.argv.slice(2));
      const res = await get(`/files/content?path=${encodeURIComponent(filePath)}`, { token, raw: true });
      const text = await res.text();
      if (res.status === 200) {
        console.log(chalk.cyan(`\n📄 ${filePath}`));
        console.log('─'.repeat(60));
        console.log(text.slice(0, 2000));
        if (text.length > 2000) console.log(chalk.dim(`\n... (${text.length - 2000} bytes más)`));
        console.log('─'.repeat(60));
      } else {
        console.log(chalk.red(`❌ Archivo no encontrado`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

filesCmd
  .command('delete <path>')
  .description('Elimina un archivo')
  .action(async (filePath) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status } = await del(`/files?path=${encodeURIComponent(filePath)}`, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Eliminado: ${filePath}`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status})`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

filesCmd
  .command('mkdir <path>')
  .description('Crea un directorio')
  .action(async (dirPath) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await post('/files/mkdir', { path: dirPath }, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Directorio creado: ${body.path || dirPath}`));
      } else {
        console.log(chalk.red(`❌ Error (${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

filesCmd
  .command('rename <path>')
  .description('Renombra un archivo')
  .requiredOption('--new-name <name>', 'Nuevo nombre')
  .action(async (filePath, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await put('/files/rename', { path: filePath, newName: opts.newName }, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Renombrado → ${body.path || opts.newName}`));
      } else {
        console.log(chalk.red(`❌ Error (${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

filesCmd
  .command('move <source> <dest>')
  .description('Mueve un archivo')
  .action(async (source, dest) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await post('/files/move', { source, dest }, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Movido → ${body.path || dest}`));
      } else {
        console.log(chalk.red(`❌ Error (${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

filesCmd
  .command('history <path>')
  .description('Muestra historial git de un archivo')
  .action(async (filePath) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await get(`/files/history?path=${encodeURIComponent(filePath)}`, { token });
      if (status === 200 && body.commits) {
        console.log(chalk.cyan(`\n📜 Historial: ${filePath}`));
        for (const c of body.commits) {
          console.log(`   ${c.hash?.slice(0, 7) || '—'}  ${c.message || ''}  ${chalk.dim(c.date || '')}`);
        }
      } else {
        console.log(chalk.dim('  Sin historial'));
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

filesCmd
  .command('recover <path>')
  .description('Recupera una versión anterior de un archivo')
  .requiredOption('--commit <hash>', 'Hash del commit')
  .action(async (filePath, opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await post('/files/recover', { path: filePath, commit: opts.commit }, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Recuperado: ${body.path || filePath}`));
      } else {
        console.log(chalk.red(`❌ Error (${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

filesCmd
  .command('push')
  .description('Hace git push del workspace')
  .action(async () => {
    try {
      const token = getToken(process.argv.slice(2));
      const { status, body } = await post('/files/push', {}, { token });
      if (status === 200) {
        console.log(chalk.green(`✅ Push exitoso`));
        if (body.output) console.log(chalk.dim(`   ${body.output.slice(0, 200)}`));
      } else {
        console.log(chalk.red(`❌ Error (${status}): ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

// ── api-key ────────────────────────────────────────────────────────────────

program
  .command('api-key create')
  .description('Crea una API key')
  .requiredOption('--name <name>', 'Nombre descriptivo')
  .option('--scopes <scopes>', 'Scopes (default: soma:read,soma:write)')
  .action(async (opts) => {
    try {
      const token = getToken(process.argv.slice(2));
      const body = { name: opts.name };
      if (opts.scopes) body.scopes = opts.scopes.split(',').map(s => s.trim());
      const { status, body: data } = await post('/api-keys', body, { token });
      if (status === 201) {
        console.log(chalk.green(`\n✅ API key creada:`));
        console.log(`   ${chalk.bold(data.api_key)}`);
        console.log(chalk.dim(`\n   Guardala en un lugar seguro. No se volverá a mostrar.`));
      } else {
        console.log(chalk.red(`❌ Error (HTTP ${status}): ${data.error || ''}`));
        process.exit(1);
      }
    } catch (err) {
      console.log(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

// ── doctor ─────────────────────────────────────────────────────────────────

program
  .command('doctor')
  .description('Diagnóstico completo de Soma (10 checks)')
  .action(async () => {
    console.log(chalk.cyan('\n🩺 Soma Doctor — 10 checks\n'));
    const results = [];

    async function check(name, fn) {
      process.stdout.write(`   ${chalk.dim('⏳')} ${name}... `);
      try {
        const ok = await fn();
        if (ok) {
          process.stdout.write(chalk.green('✅') + '\n');
          results.push({ name, ok: true });
        } else {
          process.stdout.write(chalk.red('❌') + '\n');
          results.push({ name, ok: false });
        }
      } catch (err) {
        process.stdout.write(chalk.red(`❌ ${err.message.slice(0, 30)}`) + '\n');
        results.push({ name, ok: false, error: err.message });
      }
    }

    await check('Health endpoint', async () => {
      const { status } = await get('/health');
      return status === 200;
    });

    await check('Agent list', async () => {
      const { status, body } = await get('/agents');
      return status === 200 && body.data !== undefined;
    });

    await check('Skill list', async () => {
      const { status, body } = await get('/skills');
      return status === 200 && body.data !== undefined;
    });

    await check('Conversation list', async () => {
      const { status, body } = await get('/conversations');
      return status === 200 && body.data !== undefined;
    });

    await check('Agent WebSocket', async () => {
      const token = getToken(process.argv.slice(2));
      const baseUrl = getBaseUrl(process.argv.slice(2));
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/agent-ws';

      // Obtener un agente para testear
      const { body } = await get('/agents', { token });
      const agents = body?.data || [];
      const agentId = agents[0]?.id;
      if (!agentId) return false;

      const { default: WebSocket } = await import('ws');
      return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => { ws.close(); resolve(false); }, 5000);
        ws.on('open', () => ws.send(JSON.stringify({ type: 'init', uid: agentId, cid: 'doctor-test', token })));
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'ready') {
              clearTimeout(timer);
              ws.close();
              resolve(true);
            }
          } catch { resolve(false); }
        });
        ws.on('error', () => { clearTimeout(timer); resolve(false); });
      });
    });

    await check('Agent chat (prompt)', async () => {
      const token = getToken(process.argv.slice(2));
      const baseUrl = getBaseUrl(process.argv.slice(2));
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/agent-ws';

      const { body } = await get('/agents', { token });
      const agentId = body?.data?.[0]?.id;
      if (!agentId) return false;

      const { default: WebSocket } = await import('ws');
      return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => { ws.close(); resolve(false); }, 15000);
        ws.on('open', () => ws.send(JSON.stringify({ type: 'init', uid: agentId, cid: 'doctor-test-2', token })));
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'ready') {
              ws.send(JSON.stringify({ type: 'prompt', text: 'Decí "ok" en una palabra' }));
            }
            if (msg.type === 'done') {
              clearTimeout(timer);
              ws.close();
              resolve(true);
            }
            if (msg.type === 'error') {
              clearTimeout(timer);
              resolve(false);
            }
          } catch { resolve(false); }
        });
        ws.on('error', () => { clearTimeout(timer); resolve(false); });
      });
    });

    await check('File write/read', async () => {
      const token = getToken(process.argv.slice(2));
      const testPath = '.doctor-test-' + Date.now() + '.txt';
      // upload
      const data = Buffer.from('doctor-test').toString('base64');
      const { status: s1 } = await post('/files/unified/upload', {
        owner_type: 'user',
        owner_id: 'c0000000-852c-44e5-aee1-a761ec76eaea',
        name: testPath,
        data,
      }, { token });
      if (s1 !== 200) return false;

      // read via content endpoint (usamos files/content con path absoluto al sandbox)
      const { status: s2 } = await get(`/files/unified?owner_type=user&owner_id=c0000000-852c-44e5-aee1-a761ec76eaea`, { token });
      return s2 === 200;
    });

    await check('Config file', async () => {
      const fs = await import('fs');
      return fs.existsSync(getConfigPath());
    });

    // Summary
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    console.log(`\n${'─'.repeat(40)}`);
    if (failed === 0) {
      console.log(chalk.green(`🎉 ${passed}/${results.length} checks passed`));
    } else {
      console.log(chalk.yellow(`⚠️  ${passed}/${results.length} checks passed, ${failed} fallaron`));
    }
    console.log('');
  });

// ── Parse ──────────────────────────────────────────────────────────────────

// Manejar stdin para chat one-shot con pipe
if (process.argv.includes('chat') && !process.stdin.isTTY) {
  // Si hay pipe, leer stdin y pasarlo como prompt
  let stdinData = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { stdinData += chunk; });
  process.stdin.on('end', () => {
    if (stdinData.trim()) {
      // Insertar --prompt con el contenido de stdin
      const chatIdx = process.argv.indexOf('chat');
      const agentIdIdx = chatIdx + 1;
      const promptIdx = process.argv.indexOf('-p') >= 0 ? process.argv.indexOf('-p') : process.argv.indexOf('--prompt');
      if (promptIdx >= 0) {
        process.argv[promptIdx + 1] = stdinData.trim() + '\n\n' + (process.argv[promptIdx + 1] || '');
      } else {
        process.argv.splice(agentIdIdx + 1, 0, '-p', stdinData.trim());
      }
    }
    program.parse(process.argv);
  });
} else {
  program.parse(process.argv);
}
