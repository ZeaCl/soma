import chalk from 'chalk';
import { createInterface } from 'readline';
import { getClientOpts } from '../lib/client.js';
import t from '../lib/i18n.js';

export async function runChat(agentId, opts = {}) {
  const { token, baseUrl } = getClientOpts();
  const convId = opts.continue || `cli-${Date.now()}`;

  const { default: WebSocket } = await import('ws');
  const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/agent-ws';

  console.log(chalk.cyan(`\n🧠 ${t.chat.connecting} ${agentId.slice(0, 8)}...`));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let streaming = false;
    let rl = null;
    const pendingPrompt = opts.prompt || null;

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'init', uid: agentId, cid: convId, token }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case 'ready':
            console.log(chalk.green(t.chat.ready));
            if (pendingPrompt) ws.send(JSON.stringify({ type: 'prompt', text: pendingPrompt }));
            else if (!opts.prompt) startReadline(ws);
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
            if (opts.prompt) ws.close();
            else showPrompt();
            break;
          case 'cancelled':
            streaming = false;
            console.log(chalk.yellow(`\n${t.chat.cancelled}`));
            showPrompt();
            break;
          case 'error':
            console.log(chalk.red(`\n❌ ${msg.message}`));
            if (opts.prompt) ws.close();
            else showPrompt();
            break;
        }
      } catch (err) {
        if (process.env.DEBUG) console.error(chalk.dim(`\n[debug] parse error: ${err.message}`));
      }
    });

    ws.on('error', (err) => {
      if (rl) rl.close();
      console.error(chalk.red(`\n${t.chat.connection_error}: ${err.message}`));
      reject(err);
    });

    ws.on('close', () => {
      if (rl) rl.close();
      if (!opts.prompt) console.log(chalk.dim(`\n${t.chat.goodbye}`));
      resolve();
    });

    function startReadline() {
      console.log(chalk.dim(`\n  ${t.chat.prompt_hint}\n`));
      showPrompt();
      rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
      rl.on('line', (line) => {
        const text = line.trim();
        if (text === '') return showPrompt();
        ws.send(JSON.stringify({ type: 'prompt', text }));
      });
      rl.on('close', () => {
        if (streaming) ws.send(JSON.stringify({ type: 'cancel' }));
        else ws.close();
      });
    }

    function showPrompt() {
      process.stdout.write(chalk.green('▸ '));
    }

    setTimeout(() => {
      if (!ws.readyState || ws.readyState === 0) {
        console.error(chalk.red(t.chat.connection_timeout));
        ws.close();
        reject(new Error('Connection timeout'));
      }
    }, 15000);
  });
}
