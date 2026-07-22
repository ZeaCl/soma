#!/usr/bin/env node
/**
 * zea-soma — CLI for ZEA Soma AgentHub
 */

import { Command } from 'commander';
import chalk from 'chalk';

import { get } from './lib/api.js';
import { runChat } from './commands/chat.js';
import { register as registerAgent } from './commands/agent.js';
import { register as registerSkill } from './commands/skill.js';
import { register as registerConv } from './commands/conv.js';
import { register as registerSandbox } from './commands/sandbox.js';
import { register as registerFiles } from './commands/files.js';
import { register as registerApiKey } from './commands/apikey.js';
import { register as registerDoctor } from './commands/doctor.js';
import t from './lib/i18n.js';

// ── --zea-discover ─────────────────────────────────────────────────────────

if (process.argv.includes('--zea-discover')) {
  console.log(JSON.stringify({
    description: t.discover.description,
    commands: {
      'agent list': t.discover.agent_list,
      'agent show': t.discover.agent_show,
      'agent create': t.discover.agent_create,
      'agent config': t.discover.agent_config,
      'agent delete': t.discover.agent_delete,
      'agent share': t.discover.agent_share,
      'skill list': t.discover.skill_list,
      'skill show': t.discover.skill_show,
      'skill create': t.discover.skill_create,
      'skill edit': t.discover.skill_edit,
      'skill delete': t.discover.skill_delete,
      'skill assign': t.discover.skill_assign,
      'conv list': t.discover.conv_list,
      'conv show': t.discover.conv_show,
      'conv delete': t.discover.conv_delete,
      'chat': t.discover.chat,
      'sandbox create': t.discover.sandbox_create,
      'sandbox destroy': t.discover.sandbox_destroy,
      'sandbox files': t.discover.sandbox_files,
      'files list': t.discover.files_list,
      'files upload': t.discover.files_upload,
      'files read': t.discover.files_read,
      'files delete': t.discover.files_delete,
      'files mkdir': t.discover.files_mkdir,
      'files rename': t.discover.files_rename,
      'files move': t.discover.files_move,
      'files history': t.discover.files_history,
      'files recover': t.discover.files_recover,
      'files push': t.discover.files_push,
      'api-key create': t.discover.apikey_create,
      'health': t.discover.health,
      'doctor': t.discover.doctor,
    },
  }, null, 2));
  process.exit(0);
}

// ── Commander ──────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('zea-soma')
  .description('ZEA Soma AgentHub — gestión de agentes, skills, sandboxes y chat')
  .version('0.2.0')
  .option('--token <token>', 'Bearer token (o usar ZEA_TOKEN env var)')
  .option('--base-url <url>', 'Soma API URL (default: http://soma.zea.localhost)')
  .option('--json', 'Output en formato JSON');

// ── health ─────────────────────────────────────────────────────────────────

program
  .command('health')
  .description(t.discover.health)
  .action(async () => {
    try {
      const { status, body } = await get('/health');
      if (status === 200) {
        console.log(chalk.green(t.health.ok));
        console.log(`   ${t.health.status}: ${chalk.green(body.status)}`);
        console.log(`   ${t.health.service}: ${body.service}`);
      } else {
        console.error(chalk.red(`${t.health.fail} (HTTP ${status})`));
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red(`${t.health.no_connect}: ${err.message}`));
      process.exit(1);
    }
  });

// ── Register modules ───────────────────────────────────────────────────────

registerAgent(program);
registerSkill(program);
registerConv(program);
registerSandbox(program);
registerFiles(program);
registerApiKey(program);
registerDoctor(program);

// ── chat ───────────────────────────────────────────────────────────────────

program
  .command('chat <agent-id>')
  .description(t.discover.chat)
  .option('-p, --prompt <text>', 'Prompt one-shot (sin modo interactivo)')
  .option('--continue <conv-id>', 'ID de conversación a continuar')
  .action(async (agentId, opts) => {
    try {
      await runChat(agentId, { prompt: opts.prompt, continue: opts.continue });
    } catch (err) {
      console.error(chalk.red(`❌ ${err.message}`));
      process.exit(1);
    }
  });

// ── Parse ──────────────────────────────────────────────────────────────────

program.parse(process.argv);
