import chalk from 'chalk';
import { get, post, put, del, output, isJsonMode, printTable } from '../lib/api.js';
import t from '../lib/i18n.js';

export function register(program) {
  const agentCmd = program.command('agent').description(t.discover.agent_list.split(' ').slice(1).join(' '));

  agentCmd.command('list').description(t.discover.agent_list).action(async () => {
    try {
      const { status, body } = await get('/agents');
      if (status === 200 && body.data) {
        if (isJsonMode()) { output(body); return; }
        if (body.data.length === 0) { console.log(chalk.dim('  ' + t.agent.no_agents)); return; }
        const rows = body.data.map(a => [
          a.id?.slice(0, 8) || '—',
          a.name || a.email || '—',
          (a.agent_config?.engine) || 'pi',
          (a.agent_config?.skills || []).join(', ') || '—',
          a.is_agent ? '🟢' : '👤',
        ]);
        printTable(t.agent.table_headers, rows);
        console.log(`\n  ${t.misc.total_agents}: ${body.data.length} ${t.agent.total}`);
      } else {
        console.error(chalk.red(t.errors.http_error.replace('{code}', status)));
        process.exit(1);
      }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  agentCmd.command('show <id>').description(t.discover.agent_show).action(async (id) => {
    try {
      const { status, body } = await get(`/agents/${id}`);
      if (status === 200 && body.data) {
        if (isJsonMode()) { output(body.data); return; }
        const a = body.data, cfg = a.agent_config || {};
        console.log(chalk.cyan(`\n🤖 ${a.name || a.email || a.id}`));
        console.log(`   ID:     ${a.id}`);
        console.log(`   Email:  ${a.email || '—'}`);
        console.log(`   ${t.agent.engine}: ${cfg.engine || 'pi'}`);
        console.log(`   ${t.agent.model}:  ${cfg.model || t.agent.default}`);
        console.log(`   ${t.agent.skills}: ${(cfg.skills || []).join(', ') || t.agent.none}`);
        if (cfg.system_prompt) {
          console.log(`\n   ${chalk.dim(t.agent.system_prompt + ':')}`);
          console.log(`   ${cfg.system_prompt.slice(0, 200)}${cfg.system_prompt.length > 200 ? '...' : ''}`);
        }
      } else { console.error(chalk.red(t.agent.not_found)); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  agentCmd.command('create').description(t.discover.agent_create)
    .option('--name <name>', 'Nombre del agente')
    .option('--email <email>', 'Email del agente')
    .option('--system-prompt <text>', 'System prompt')
    .option('--skills <list>', 'Skills separadas por coma')
    .option('--engine <engine>', 'Engine (pi, react, opencode)', 'pi')
    .option('--model <model>', 'Modelo LLM')
    .action(async (opts) => {
      try {
        const skills = opts.skills ? opts.skills.split(',').map(s => s.trim()) : [];
        console.log(chalk.cyan(t.agent.creating));
        const { status, body: data } = await post('/agents', {
          name: opts.name, email: opts.email, is_agent: true,
          agent_config: { engine: opts.engine, model: opts.model, system_prompt: opts.systemPrompt, skills },
        });
        if (status === 201) {
          if (isJsonMode()) { output(data); return; }
          console.log(chalk.green(`${t.agent.created}: ${data.data?.id || data.data?.name}`));
          if (skills.length) console.log(`   ${t.agent.skills}: ${skills.join(', ')}`);
        } else {
          console.error(chalk.red(t.errors.http_error.replace('{code}', status) + `: ${data.error || ''}`));
          process.exit(1);
        }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  agentCmd.command('config <id>').description(t.discover.agent_config)
    .option('--system-prompt <text>', 'Nuevo system prompt')
    .option('--model <model>', 'Nuevo modelo LLM')
    .option('--skills <list>', 'Nuevas skills (coma separadas)')
    .action(async (id, opts) => {
      try {
        const config = {};
        if (opts.systemPrompt) config.system_prompt = opts.systemPrompt;
        if (opts.model) config.model = opts.model;
        if (opts.skills) config.skills = opts.skills.split(',').map(s => s.trim());
        const { status, body } = await put(`/agents/${id}/config`, config);
        if (status === 200) {
          if (isJsonMode()) { output(body); return; }
          console.log(chalk.green(`${t.agent.config_updated} ${id.slice(0, 8)}...`));
        } else {
          console.error(chalk.red(t.errors.http_error.replace('{code}', status) + `: ${body.error || ''}`));
          process.exit(1);
        }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  agentCmd.command('delete <id>').description(t.discover.agent_delete).action(async (id) => {
    try {
      const { status } = await del(`/agents/${id}`);
      if (status === 200) console.log(chalk.green(`${t.agent.deleted}: ${id.slice(0, 8)}...`));
      else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  agentCmd.command('share <id>').description(t.discover.agent_share)
    .requiredOption('--with <user-id>', 'ID del usuario')
    .action(async (id, opts) => {
      try {
        const { status, body } = await post(`/agents/${id}/share`, { shared_with_user_id: opts.with });
        if (status === 200) console.log(chalk.green(`${t.agent.shared} ${opts.with.slice(0, 8)}...`));
        else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  agentCmd.command('unshare <id>').description('Deja de compartir un agente')
    .requiredOption('--user <user-id>', 'ID del usuario')
    .action(async (id, opts) => {
      try {
        const { status } = await del(`/agents/${id}/share/${opts.user}`);
        if (status === 200) console.log(chalk.green(t.agent.unshared));
        else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  agentCmd.command('shares <id>').description('Lista con quién está compartido').action(async (id) => {
    try {
      const { status, body } = await get(`/agents/${id}/shares`);
      if (status === 200 && body.data) {
        if (isJsonMode()) { output(body.data); return; }
        if (body.data.length === 0) { console.log(chalk.dim('  ' + t.agent.no_shares)); return; }
        for (const s of body.data) console.log(`  👤 ${s.shared_with_user_id?.slice(0, 8)}... (por ${s.shared_by_user_id?.slice(0, 8)}...)`);
      }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });
}
