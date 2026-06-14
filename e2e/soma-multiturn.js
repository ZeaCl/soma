/**
 * Soma E2E — Multi-turn conversation test
 *
 * Validates:
 * 1. Agent responds and response PERSISTS (doesn't disappear)
 * 2. Multi-turn conversation works (user → agent → user → agent)
 * 3. Console logs show proper flow (deltas accumulated, done with content)
 *
 * Usage: node soma-multiturn.js
 * Screenshots: /tmp/soma-e2e/
 */

const { chromium } = require('playwright');
const fs = require('fs');

const DIR = '/tmp/soma-e2e';
fs.mkdirSync(DIR, { recursive: true });

const BASE = 'http://soma.zea.localhost';
const COLORS = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const PASS = `${COLORS.green}PASS${COLORS.reset}`;
const FAIL = `${COLORS.red}FAIL${COLORS.reset}`;

let failCount = 0;

async function shot(page, name) {
  await page.screenshot({ path: `${DIR}/${name}`, fullPage: false });
}

function check(condition, label) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
  } else {
    console.log(`  ${FAIL} ${label}`);
    failCount++;
  }
}

(async () => {
  console.log(`\n${COLORS.cyan}🧪 Soma Multi-Turn E2E${COLORS.reset}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Collect browser console logs
  const browserLogs = [];
  page.on('console', msg => {
    browserLogs.push(`[${msg.type()}] ${msg.text()}`);
    // Print useGlia logs for debugging
    if (msg.text().includes('[useGlia]')) {
      console.log(`  🌐 ${msg.text()}`);
    }
  });

  try {
    // ── Step 1: Navigate & Authenticate ──────────────────────────────────

    console.log('1. Landing page');
    await page.goto(BASE);
    await page.waitForTimeout(1500);
    await shot(page, '01-landing.png');

    // Click Get Started
    console.log('2. Get Started → Login');
    await page.locator('button').filter({ hasText: /Launch|Get Started|Sign in|AgentHub/ }).first().click();
    await page.waitForTimeout(3000);

    // Login if needed
    if (page.url().includes('login')) {
      await page.fill('input[name="session[email]"]', 'test@example.com');
      await page.fill('input[name="session[password]"]', 'test_password_123');
      await shot(page, '02-login.png');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }

    // Consent if needed
    if (page.url().includes('authorize')) {
      await shot(page, '03-consent.png');
      console.log('3. Authorize');
      await page.locator('button[value="approve"]').click();
      await page.waitForTimeout(4000);
    }

    // Ensure we're on Soma chat
    if (!page.url().includes('soma.zea.localhost')) {
      await page.goto(BASE);
      await page.waitForTimeout(2000);
    }
    console.log(`4. Chat page: ${page.url().slice(0, 60)}`);
    await shot(page, '04-chat.png');

    // ── Step 2: Wait for WebSocket ready ─────────────────────────────────

    const textarea = page.locator('textarea').last();
    check(await textarea.count() > 0, 'Textarea found');

    // Wait for [useGlia] ready log
    console.log('5. Waiting for WebSocket ready...');
    await page.waitForTimeout(3000);

    // ── Step 3: Turn 1 — Send first message ──────────────────────────────

    const prompt1 = 'Responde exactamente: PRIMERA RESPUESTA';
    console.log(`\n6. Turn 1: "${prompt1}"`);
    await textarea.fill(prompt1);
    await shot(page, '05-turn1-typed.png');
    await page.locator('button.glia-btn-send').last().click();
    console.log('   Sent!');

    // Wait for streaming to start
    await page.waitForTimeout(2000);
    await shot(page, '06-turn1-streaming.png');

    // Wait for agent response to complete (feed grows)
    let feedLen1 = 0;
    let responded1 = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(2000);
      const feed = await page.textContent('.glia-feed');
      feedLen1 = feed?.length || 0;
      const bubbles = await page.locator('.glia-msg').count();
      const streamEls = await page.locator('.glia-stream').count();
      console.log(`   t+${(i+1)*2}s: feed=${feedLen1} bubbles=${bubbles} stream=${streamEls}`);

      // Response complete: feed > 30 chars, has user + assistant messages, no stream
      if (feedLen1 > 30 && bubbles >= 2 && streamEls === 0) {
        responded1 = true;
        break;
      }
      // If streaming ended but no assistant bubble, something's wrong
      if (i > 4 && streamEls === 0 && bubbles < 2) {
        console.log(`   ${COLORS.yellow}⚠️ Stream ended but assistant bubble missing${COLORS.reset}`);
        break;
      }
    }

    await shot(page, '07-turn1-done.png');
    check(responded1, 'Turn 1: Agent responded');
    check(feedLen1 > 30, `Turn 1: Feed has content (${feedLen1} chars)`);

    // Verify thinking persisted in message bubble
    const thinkingBlocks1 = await page.locator('.glia-thinking-persisted').count();
    console.log(`   Thinking blocks (persisted): ${thinkingBlocks1}`);
    check(thinkingBlocks1 >= 1, `Turn 1: Thinking persisted (${thinkingBlocks1} blocks)`);

    // Click to expand thinking
    if (thinkingBlocks1 > 0) {
      await page.locator('.glia-thinking-persisted button').first().click();
      await page.waitForTimeout(500);
      const thinkingText = await page.locator('.glia-thinking-persisted').first().textContent();
      console.log(`   Thinking preview: "${(thinkingText || '').slice(0, 80)}..."`);
      check((thinkingText?.length || 0) > 10, 'Turn 1: Thinking has content when expanded');
    }

    // Check that response PERSISTS (wait 5 more seconds and verify feed doesn't shrink)
    if (responded1) {
      await page.waitForTimeout(5000);
      const feedAfter = await page.textContent('.glia-feed');
      const lenAfter = feedAfter?.length || 0;
      const bubblesAfter = await page.locator('.glia-msg').count();
      const thinkingAfter = await page.locator('.glia-thinking-persisted').count();
      console.log(`   After 5s wait: feed=${lenAfter} bubbles=${bubblesAfter} thinking=${thinkingAfter}`);
      check(lenAfter > 30, `Turn 1: Response PERSISTS (${lenAfter} chars after 5s)`);
      check(bubblesAfter >= 2, `Turn 1: Bubbles persist (${bubblesAfter})`);
      check(thinkingAfter >= 1, `Turn 1: Thinking PERSISTS (${thinkingAfter} blocks)`);
      await shot(page, '08-turn1-persists.png');
    }

    // ── Step 4: Turn 2 — Send second message ─────────────────────────────

    const prompt2 = 'Ahora responde exactamente: SEGUNDA RESPUESTA CONFIRMADA';
    console.log(`\n7. Turn 2: "${prompt2}"`);
    await textarea.fill(prompt2);
    await page.locator('button.glia-btn-send').last().click();
    console.log('   Sent!');

    await page.waitForTimeout(2000);
    await shot(page, '09-turn2-streaming.png');

    let responded2 = false;
    let feedLen2 = 0;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(2000);
      const feed = await page.textContent('.glia-feed');
      feedLen2 = feed?.length || 0;
      const bubbles = await page.locator('.glia-msg').count();
      const streamEls = await page.locator('.glia-stream').count();
      console.log(`   t+${(i+1)*2}s: feed=${feedLen2} bubbles=${bubbles} stream=${streamEls}`);

      if (feedLen2 > 50 && bubbles >= 3 && streamEls === 0) {
        responded2 = true;
        break;
      }
    }

    await shot(page, '10-turn2-done.png');
    check(responded2, 'Turn 2: Agent responded');
    check(feedLen2 > 50, `Turn 2: Feed has content (${feedLen2} chars)`);

    // Verify thinking persisted for both turns
    const thinkingBlocks2 = await page.locator('.glia-thinking-persisted').count();
    console.log(`   Thinking blocks total: ${thinkingBlocks2}`);
    check(thinkingBlocks2 >= 2, `Both turns have thinking persisted (${thinkingBlocks2} blocks)`);

    // Verify Turn 1 response is still there AND Turn 2 response is there
    const allText = await page.textContent('.glia-feed');
    const hasTurn1 = allText?.includes('PRIMERA RESPUESTA');
    const hasTurn2 = allText?.includes('SEGUNDA RESPUESTA');
    check(hasTurn1, 'Turn 1: Response still visible');
    check(hasTurn2, 'Turn 2: Response visible');
    await shot(page, '11-both-turns.png');

    // ── Step 5: Console log analysis ─────────────────────────────────────

    console.log(`\n${COLORS.cyan}8. Console Log Analysis${COLORS.reset}`);

    const useGliaLogs = browserLogs.filter(l => l.includes('[useGlia]'));
    const deltaCount = useGliaLogs.filter(l => l.includes('← done')).length;
    const doneLogs = useGliaLogs.filter(l => l.includes('← done'));
    const lostWarnings = useGliaLogs.filter(l => l.includes('NO content accumulated'));
    const errorLogs = useGliaLogs.filter(l => l.includes('error'));

    console.log(`   Total useGlia logs: ${useGliaLogs.length}`);
    console.log(`   Done events: ${deltaCount}`);
    console.log(`   Lost warnings: ${lostWarnings.length}`);
    console.log(`   Error logs: ${errorLogs.length}`);

    check(deltaCount >= 2, `At least 2 done events (got ${deltaCount})`);
    check(lostWarnings.length === 0, `No lost content warnings (got ${lostWarnings.length})`);

    // Print done logs
    for (const log of doneLogs) {
      console.log(`   📋 ${log.slice(0, 200)}`);
    }

    // ── Step 6: Final report ──────────────────────────────────────────────

    console.log(`\n${COLORS.cyan}══════════════════════════════════════${COLORS.reset}`);
    console.log(`${COLORS.cyan}  📊 Final Report${COLORS.reset}`);
    console.log(`${COLORS.cyan}══════════════════════════════════════${COLORS.reset}`);

    const messages = await page.locator('.glia-msg').count();
    const feedContent = await page.textContent('.glia-feed');
    const finalLen = feedContent?.length || 0;

    console.log(`  Messages: ${messages}`);
    console.log(`  Feed length: ${finalLen} chars`);
    console.log(`  Turn 1 visible: ${hasTurn1}`);
    console.log(`  Turn 2 visible: ${hasTurn2}`);
    console.log(`  Failures: ${failCount}`);

    // Save browser logs
    fs.writeFileSync(`${DIR}/browser-logs.txt`, browserLogs.join('\n'));
    console.log(`\n  📁 Screenshots: ${DIR}/`);
    console.log(`  📁 Browser logs: ${DIR}/browser-logs.txt`);

    if (failCount === 0) {
      console.log(`\n${COLORS.green}🎉 ALL CHECKS PASSED — Multi-turn conversation works!${COLORS.reset}`);
      process.exit(0);
    } else {
      console.log(`\n${COLORS.red}❌ ${failCount} CHECK(S) FAILED${COLORS.reset}`);
      process.exit(1);
    }

  } catch (e) {
    console.log(`\n${COLORS.red}❌ ${e.message}${COLORS.reset}`);
    await shot(page, '99-crash.png');
    fs.writeFileSync(`${DIR}/browser-logs.txt`, browserLogs.join('\n'));
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
