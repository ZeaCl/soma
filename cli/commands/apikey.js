import chalk from 'chalk';
import { post, output, isJsonMode } from '../lib/api.js';
import t from '../lib/i18n.js';

export function register(program) {
  program.command('api-key create').description(t.discover.apikey_create)
    .requiredOption('--name <name>', 'Nombre descriptivo')
    .option('--scopes <scopes>', 'Scopes (default: soma:read,soma:write)')
    .action(async (opts) => {
      try {
        const body = { name: opts.name };
        if (opts.scopes) body.scopes = opts.scopes.split(',').map(s => s.trim());
        const { status, body: data } = await post('/api-keys', body);
        if (status === 201) {
          if (isJsonMode()) { output(data); return; }
          console.log(chalk.green(`\n${t.apikey.created}:`));
          console.log(`   ${chalk.bold(data.api_key)}`);
          console.log(chalk.dim(`\n   ${t.apikey.warning}`));
        } else {
          console.error(chalk.red(t.errors.http_error.replace('{code}', status) + `: ${data.error || ''}`));
          process.exit(1);
        }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });
}
