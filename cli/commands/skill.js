import chalk from 'chalk';
import fs from 'fs';
import { get, post, put, del, output, isJsonMode, printTable } from '../lib/api.js';
import t from '../lib/i18n.js';

export function register(program) {
  const skillCmd = program.command('skill').description('Gestión de skills');

  skillCmd.command('list').description(t.discover.skill_list).action(async () => {
    try {
      const { status, body } = await get('/skills');
      if (status === 200 && body.data) {
        if (isJsonMode()) { output(body.data); return; }
        if (body.data.length === 0) { console.log(chalk.dim('  ' + t.skill.no_skills)); return; }
        const rows = body.data.map(s => [s.name, s.source || 'custom', (s.description || '—').slice(0, 80)]);
        printTable(t.skill.table_headers, rows);
        console.log(`\n  ${t.misc.total_skills}: ${body.data.length} ${t.skill.total}`);
      }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  skillCmd.command('show <name>').description(t.discover.skill_show).action(async (name) => {
    try {
      const { status, body } = await get(`/skills/${name}`);
      if (status === 200) {
        if (isJsonMode()) { output(body); return; }
        console.log(chalk.cyan(`\n📋 ${body.name} (${body.source || 'custom'})`));
        console.log(t.misc.separator);
        console.log(body.content);
        console.log(t.misc.separator);
      } else { console.error(chalk.red(t.skill.not_found)); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  skillCmd.command('create').description(t.discover.skill_create)
    .requiredOption('--name <name>', 'Nombre')
    .requiredOption('--file <path>', 'Archivo markdown')
    .action(async (opts) => {
      try {
        const content = fs.readFileSync(opts.file, 'utf8');
        const { status, body } = await post('/skills', { name: opts.name, content });
        if (status === 201) {
          if (isJsonMode()) { output(body.data); return; }
          console.log(chalk.green(`${t.skill.created}: ${opts.name}`));
        } else {
          console.error(chalk.red(t.errors.http_error.replace('{code}', status) + `: ${body.error || ''}`));
          process.exit(1);
        }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  skillCmd.command('edit <name>').description(t.discover.skill_edit)
    .requiredOption('--file <path>', 'Nuevo archivo markdown')
    .action(async (name, opts) => {
      try {
        const content = fs.readFileSync(opts.file, 'utf8');
        const { status, body } = await put(`/skills/${name}`, { content });
        if (status === 200) {
          if (isJsonMode()) { output(body.data); return; }
          console.log(chalk.green(`${t.skill.updated}: ${name}`));
        } else {
          console.error(chalk.red(t.errors.http_error.replace('{code}', status) + `: ${body.error || ''}`));
          process.exit(1);
        }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  skillCmd.command('delete <name>').description(t.discover.skill_delete).action(async (name) => {
    try {
      const { status } = await del(`/skills/${name}`);
      if (status === 204 || status === 200) console.log(chalk.green(`${t.skill.deleted}: ${name}`));
      else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  skillCmd.command('assign <name>').description(t.discover.skill_assign)
    .requiredOption('--agents <list>', 'IDs separados por coma')
    .action(async (name, opts) => {
      try {
        const agentIds = opts.agents.split(',').map(s => s.trim());
        const { status } = await put(`/skills/${name}/agents`, { agentIds });
        if (status === 200) console.log(chalk.green(`✅ ${t.skill.assigned.replace('{name}', name).replace('{count}', agentIds.length)}`));
        else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });
}
