import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { get, post, put, del, output, isJsonMode, formatSize } from '../lib/api.js';
import t from '../lib/i18n.js';

export function register(program) {
  const filesCmd = program.command('files').description('Gestión de archivos de workspace');

  filesCmd.command('list').description(t.discover.files_list)
    .option('--agent <id>', 'Filtrar por agente')
    .option('--user <id>', 'Filtrar por usuario')
    .option('--org <id>', 'Filtrar por organización')
    .option('--path <path>', 'Subdirectorio')
    .action(async (opts) => {
      try {
        const ownerType = opts.agent ? 'agent' : opts.user ? 'user' : 'org';
        const ownerId = opts.agent || opts.user || '';
        const orgId = opts.org || '';
        const params = new URLSearchParams({ owner_type: ownerType });
        if (ownerId) params.set('owner_id', ownerId);
        if (orgId) params.set('org_id', orgId);
        if (opts.path) params.set('path', opts.path);
        const { status, body } = await get(`/files/unified?${params}`);
        if (status === 200 && body.files) {
          if (isJsonMode()) { output(body); return; }
          if (body.files.length === 0) { console.log(chalk.dim('  ' + t.files.no_files)); return; }
          for (const f of body.files) {
            console.log(`   ${f.type === 'dir' ? '📁' : '📄'} ${f.name.padEnd(40)} ${formatSize(f.size)}`);
          }
        }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  filesCmd.command('upload <local-file>').description(t.discover.files_upload)
    .option('--agent <id>', 'Dueño agente')
    .option('--user <id>', 'Dueño usuario')
    .option('--path <path>', 'Directorio remoto')
    .action(async (localFile, opts) => {
      try {
        if (!fs.existsSync(localFile)) { console.error(chalk.red(`${t.files.not_found}: ${localFile}`)); process.exit(1); }
        const fileName = path.basename(localFile);
        const fileData = fs.readFileSync(localFile);
        const base64Data = fileData.toString('base64');
        const ownerType = opts.agent ? 'agent' : 'user';
        const ownerId = opts.agent || opts.user;
        console.log(chalk.cyan(`📤 ${t.files.uploading} ${fileName} (${formatSize(fileData.length)})...`));
        const { status, body } = await post('/files/unified/upload', {
          owner_type: ownerType, owner_id: ownerId, name: fileName, data: base64Data, path: opts.path || undefined,
        });
        if (status === 200 && body.ok) {
          if (isJsonMode()) { output(body); return; }
          console.log(chalk.green(`${t.files.uploaded} ${body.path} (${formatSize(body.size)})`));
        } else {
          console.error(chalk.red(t.errors.http_error.replace('{code}', status) + `: ${body.error || ''}`));
          process.exit(1);
        }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  filesCmd.command('read <path>').description(t.discover.files_read).action(async (filePath) => {
    try {
      const res = await get(`/files/content?path=${encodeURIComponent(filePath)}`, { raw: true });
      const text = await res.text();
      if (res.status === 200) {
        console.log(chalk.cyan(`\n📄 ${filePath}`));
        console.log(t.misc.separator);
        console.log(text.slice(0, 2000));
        if (text.length > 2000) console.log(chalk.dim(`\n... (${text.length - 2000} bytes más)`));
        console.log(t.misc.separator);
      } else { console.error(chalk.red(t.files.not_found)); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  filesCmd.command('delete <path>').description(t.discover.files_delete).action(async (fp) => {
    try {
      const { status } = await del(`/files?path=${encodeURIComponent(fp)}`);
      if (status === 200) console.log(chalk.green(`${t.files.deleted}: ${fp}`));
      else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  filesCmd.command('mkdir <path>').description(t.discover.files_mkdir).action(async (dp) => {
    try {
      const { status, body } = await post('/files/mkdir', { path: dp });
      if (status === 200) {
        if (isJsonMode()) { output(body); return; }
        console.log(chalk.green(`${t.files.dir_created}: ${body.path || dp}`));
      } else {
        console.error(chalk.red(t.errors.http_error.replace('{code}', status) + `: ${body.error || ''}`));
        process.exit(1);
      }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  filesCmd.command('rename <path>').description(t.discover.files_rename)
    .requiredOption('--new-name <name>', 'Nuevo nombre')
    .action(async (fp, opts) => {
      try {
        const { status, body } = await put('/files/rename', { path: fp, newName: opts.newName });
        if (status === 200) console.log(chalk.green(`${t.files.renamed} ${body.path || opts.newName}`));
        else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  filesCmd.command('move <source> <dest>').description(t.discover.files_move).action(async (src, dst) => {
    try {
      const { status, body } = await post('/files/move', { source: src, dest: dst });
      if (status === 200) console.log(chalk.green(`${t.files.moved} ${body.path || dst}`));
      else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  filesCmd.command('history <path>').description(t.discover.files_history).action(async (fp) => {
    try {
      const { status, body } = await get(`/files/history?path=${encodeURIComponent(fp)}`);
      if (status === 200 && body.commits) {
        if (isJsonMode()) { output(body); return; }
        console.log(chalk.cyan(`\n${t.files.history}: ${fp}`));
        for (const c of body.commits) console.log(`   ${c.hash?.slice(0, 7) || '—'}  ${c.message || ''}  ${chalk.dim(c.date || '')}`);
      } else console.log(chalk.dim('  ' + t.files.no_history));
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  filesCmd.command('recover <path>').description(t.discover.files_recover)
    .requiredOption('--commit <hash>', 'Hash del commit')
    .action(async (fp, opts) => {
      try {
        const { status, body } = await post('/files/recover', { path: fp, commit: opts.commit });
        if (status === 200) console.log(chalk.green(`${t.files.recovered}: ${body.path || fp}`));
        else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
      } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
    });

  filesCmd.command('push').description(t.discover.files_push).action(async () => {
    try {
      const { status, body } = await post('/files/push', {});
      if (status === 200) {
        if (isJsonMode()) { output(body); return; }
        console.log(chalk.green(t.files.push_ok));
        if (body.output) console.log(chalk.dim(`   ${body.output.slice(0, 200)}`));
      } else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });
}
