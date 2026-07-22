import chalk from 'chalk';
import fs from 'fs';
import { get, post } from '../lib/api.js';
import { getClientOpts } from '../lib/client.js';
import { getConfigPath } from '../lib/auth.js';
import t from '../lib/i18n.js';

export function register(program) {
  program.command('doctor').description(t.discover.doctor).action(async () => {
    console.log(chalk.cyan(`\n${t.doctor.title}\n`));
    const results = [];
    const { token, baseUrl } = getClientOpts();
    let WebSocket = null;

    async function check(name, fn) {
      process.stdout.write(`   ${chalk.dim('⏳')} ${name}... `);
      try {
        const ok = await fn();
        process.stdout.write(ok ? chalk.green('✅') + '\n' : chalk.red('❌') + '\n');
        results.push({ name, ok });
      } catch (err) {
        process.stdout.write(chalk.red(`❌ ${err.message.slice(0, 30)}`) + '\n');
        results.push({ name, ok: false, error: err.message });
      }
    }

    await check(t.doctor.checks.health, async () => { const { status } = await get('/health'); return status === 200; });
    await check(t.doctor.checks.agent_list, async () => { const { status, body } = await get('/agents'); return status === 200 && body.data !== undefined; });
    await check(t.doctor.checks.skill_list, async () => { const { status, body } = await get('/skills'); return status === 200 && body.data !== undefined; });
    await check(t.doctor.checks.conv_list, async () => { const { status, body } = await get('/conversations'); return status === 200 && body.data !== undefined; });

    await check(t.doctor.checks.agent_ws, async () => {
      const { body } = await get('/agents');
      const agents = body?.data || [];
      if (agents.length === 0) return false;
      const agentId = agents[0]?.id;
      if (!WebSocket) { const mod = await import('ws'); WebSocket = mod.default; }
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/agent-ws';
      return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => { ws.close(); resolve(false); }, 5000);
        ws.on('open', () => ws.send(JSON.stringify({ type: 'init', uid: agentId, cid: 'doctor-ws', token })));
        ws.on('message', (d) => {
          try { const m = JSON.parse(d.toString()); if (m.type === 'ready') { clearTimeout(timer); ws.close(); resolve(true); } if (m.type === 'error') { clearTimeout(timer); resolve(false); } } catch {}
        });
        ws.on('error', () => { clearTimeout(timer); resolve(false); });
      });
    });

    await check(t.doctor.checks.agent_chat, async () => {
      const { body } = await get('/agents');
      const agents = body?.data || [];
      if (agents.length === 0) return false;
      const agentId = agents[0]?.id;
      if (!WebSocket) { const mod = await import('ws'); WebSocket = mod.default; }
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/agent-ws';
      return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => { ws.close(); resolve(false); }, 15000);
        ws.on('open', () => ws.send(JSON.stringify({ type: 'init', uid: agentId, cid: 'doctor-chat', token })));
        ws.on('message', (d) => {
          try { const m = JSON.parse(d.toString()); if (m.type === 'ready') ws.send(JSON.stringify({ type: 'prompt', text: 'Decí "ok"' })); if (m.type === 'done') { clearTimeout(timer); ws.close(); resolve(true); } if (m.type === 'error') { clearTimeout(timer); resolve(false); } } catch {}
        });
        ws.on('error', () => { clearTimeout(timer); resolve(false); });
      });
    });

    await check(t.doctor.checks.file_rw, async () => {
      const testPath = '.doctor-test-' + Date.now() + '.txt';
      const data = Buffer.from('doctor-test').toString('base64');
      const { status: s1 } = await post('/files/unified/upload', { owner_type: 'user', owner_id: 'c0000000-852c-44e5-aee1-a761ec76eaea', name: testPath, data });
      if (s1 !== 200) return false;
      const { status: s2 } = await get(`/files/unified?owner_type=user&owner_id=c0000000-852c-44e5-aee1-a761ec76eaea`);
      return s2 === 200;
    });

    await check(t.doctor.checks.config_file, async () => fs.existsSync(getConfigPath()));

    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    console.log(`\n${t.misc.separator_small}`);
    if (failed === 0) console.log(chalk.green(t.doctor.all_pass.replace('{passed}', passed).replace('{total}', results.length)));
    else console.log(chalk.yellow(t.doctor.some_fail.replace('{passed}', passed).replace('{total}', results.length).replace('{failed}', failed)));
    console.log('');
  });
}
