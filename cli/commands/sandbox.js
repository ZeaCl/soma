import chalk from 'chalk';
import { get, del, output, isJsonMode, formatSize } from '../lib/api.js';
import { getClientOpts } from '../lib/client.js';
import t from '../lib/i18n.js';

export function register(program) {
  const sandboxCmd = program.command('sandbox').description('Gestión de sandboxes (usuarios y agentes)');

  sandboxCmd.command('create <id>').description(t.discover.sandbox_create)
    .requiredOption('--org <org-id>', 'Organization ID')
    .option('--type <type>', 'user o agent', 'user')
    .option('--teams <teams>', 'Teams separados por coma')
    .action(async (id, opts) => {
      try {
        const { baseUrl, token } = getClientOpts();
        const params = new URLSearchParams({ type: opts.type, user_id: id, org_id: opts.org });
        if (opts.teams) params.set('teams', opts.teams);
        console.log(chalk.cyan(`👤 ${t.sandbox.creating} ${opts.type} ${id.slice(0, 8)}...`));
        const res = await fetch(`${baseUrl}/api/sandboxes/create?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = await res.json();
        if (res.status === 201) {
          if (isJsonMode()) { output(body); return; }
          console.log(chalk.green(`${t.sandbox.created}: ${body.username}`));
          console.log(`   ${t.sandbox.home}: ${body.home}`);
          console.log(`   UID:  ${body.uid}`);
        } else {
          console.error(chalk.red(t.errors.http_error.replace('{code}', res.status) + `: ${body.error || ''}`));
          process.exit(1);
        }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  sandboxCmd.command('destroy <id>').description(t.discover.sandbox_destroy)
    .option('--type <type>', 'user o agent', 'user')
    .action(async (id, opts) => {
      try {
        const { status } = await del(`/sandboxes/${id}?type=${opts.type}`);
        if (status === 200) console.log(chalk.green(`${t.sandbox.destroyed}: ${id.slice(0, 8)}...`));
        else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  sandboxCmd.command('files <id>').description(t.discover.sandbox_files)
    .option('--type <type>', 'user o agent', 'user')
    .option('--path <path>', 'Subdirectorio')
    .action(async (id, opts) => {
      try {
        const params = new URLSearchParams({ owner_type: opts.type, owner_id: id });
        if (opts.path) params.set('path', opts.path);
        const { status, body } = await get(`/files/unified?${params}`);
        if (status === 200 && body.files) {
          if (isJsonMode()) { output(body); return; }
          if (body.files.length === 0) { console.log(chalk.dim('  ' + t.sandbox.no_files)); return; }
          console.log(chalk.cyan(`📁 ${t.sandbox.files_of} ${id.slice(0, 8)}...${opts.path ? '/' + opts.path : ''}:`));
          for (const f of body.files) {
            console.log(`   ${f.type === 'dir' ? '📁' : '📄'} ${f.name.padEnd(40)} ${formatSize(f.size)}`);
          }
        }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });
}
