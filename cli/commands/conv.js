import chalk from 'chalk';
import { get, del, output, isJsonMode, printTable } from '../lib/api.js';
import t from '../lib/i18n.js';

export function register(program) {
  const convCmd = program.command('conv').description('Gestión de conversaciones');

  convCmd.command('list').description(t.discover.conv_list).action(async () => {
    try {
      const { status, body } = await get('/conversations');
      if (status === 200 && body.data) {
        if (isJsonMode()) { output(body); return; }
        if (body.data.length === 0) { console.log(chalk.dim('  ' + t.conv.no_convs)); return; }
        const rows = body.data.map(c => [
          c.id?.slice(0, 12) || '—',
          c.title || c.agent_id?.slice(0, 8) || '—',
          String(c.message_count || 0),
          c.last_message_at?.slice(0, 16) || '—',
        ]);
        printTable(t.conv.table_headers, rows);
        console.log(`\n  ${t.misc.total_convs}: ${body.total || body.data.length} ${t.conv.total}`);
      }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  convCmd.command('show <id>').description(t.discover.conv_show).action(async (id) => {
    try {
      const { status, body } = await get(`/conversations/${id}`);
      if (status === 200) {
        if (isJsonMode()) { output(body); return; }
        console.log(chalk.cyan(`\n💬 Conversación: ${body.id?.slice(0, 12)}...`));
        console.log(`   Título: ${body.title || t.conv.untitled}`);
        console.log(`   ${t.conv.messages}: ${body.messages?.length || 0}`);
        console.log(t.misc.separator);
        for (const m of (body.messages || [])) {
          const roleIcon = m.role === 'user' ? '👤' : '🤖';
          console.log(`\n${roleIcon} ${chalk.bold(m.role)} — ${m.timestamp?.slice(0, 16) || ''}`);
          if (m.thinking) console.log(chalk.dim(`   🧠 ${m.thinking.slice(0, 120)}${m.thinking.length > 120 ? '...' : ''}`));
          console.log(`   ${m.content?.slice(0, 300) || t.conv.no_content}${(m.content?.length || 0) > 300 ? '...' : ''}`);
        }
        console.log('\n' + t.misc.separator);
      } else { console.error(chalk.red(t.conv.not_found)); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });

  convCmd.command('delete <id>').description(t.discover.conv_delete).action(async (id) => {
    try {
      const { status } = await del(`/conversations/${id}`);
      if (status === 200) console.log(chalk.green(t.conv.deleted));
      else { console.error(chalk.red(t.errors.http_error.replace('{code}', status))); process.exit(1); }
    } catch (err) { console.error(chalk.red(err.message)); process.exit(1); }
  });
}
