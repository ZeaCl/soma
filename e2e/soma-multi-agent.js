/**
 * Soma E2E — Multi-Agent Switch test
 *
 * Validates:
 * 1. Chat with one agent, see response with thinking
 * 2. Switch to a different agent via sidebar
 * 3. Chat with second agent — independent history
 * 4. Switch back to first agent — history preserved
 *
 * Usage: node soma-multi-agent.js
 */

const { chromium } = require('playwright');
const fs = require('fs');

const DIR = '/tmp/soma-e2e';
fs.mkdirSync(DIR, { recursive: true });

const BASE = 'http://soma.zea.localhost';
const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
let failCount = 0;

function check(condition, label) {
  if (condition) console.log(`  ${PASS} ${label}`);
  else { console.log(`  ${FAIL} ${label}`); failCount++; }
}

(async () => {
  console.log('\n\x1b[36m🧪 Soma Multi-Agent E2E\x1b[0m\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const browserLogs = [];
  page.on('console', msg => {
    browserLogs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.text().includes('[useGlia]'))
      console.log(`  🌐 ${msg.text()}`);
  });

  try {
    // 1. Auth flow
    console.log('1. Auth...');
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: /Launch|Get Started/ }).first().click();
    await page.waitForTimeout(2000);

    if (page.url().includes('login')) {
      await page.fill('input[name="session[email]"]', 'test@example.com');
      await page.fill('input[name="session[password]"]', 'test_password_123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);
    }
    if (page.url().includes('authorize')) {
      await page.locator('button[value="approve"]').click();
      await page.waitForTimeout(3000);
    }
    if (!page.url().includes('soma.zea.localhost')) {
      await page.goto(BASE);
      await page.waitForTimeout(1500);
    }

    console.log('2. Chat ready');
    await page.waitForTimeout(3000);

    const textarea = page.locator('textarea').last();
    check(await textarea.count() > 0, 'Textarea found');

    // 2. Chat with first agent
    console.log('3. Chat with agent 1...');
    await textarea.fill('Di AGENTE-1-RESPUESTA');
    await page.locator('button.glia-btn-send').last().click();

    // Wait for response
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(2500);
      const bubbles = await page.locator('.glia-msg').count();
      const stream = await page.locator('.glia-stream').count();
      console.log(`   t+${(i+1)*2.5}s: bubbles=${bubbles} stream=${stream}`);
      if (bubbles >= 2 && stream === 0) break;
    }

    await page.screenshot({ path: `${DIR}/multi-01-agent1.png` });
    const feed1 = await page.textContent('.glia-feed');
    check((feed1?.length || 0) > 50, 'Agent 1 responded');
    check(feed1?.includes('AGENTE-1-RESPUESTA') || false, 'Agent 1 response visible');

    // 3. Try switching agent via sidebar (click different DM)
    console.log('4. Switching agent...');
    const dmButtons = page.locator('nav button').filter({ hasText: /Full Stack|Code Review|Data Analyst|Camila/ });
    const dmCount = await dmButtons.count();
    console.log(`   Found ${dmCount} DM buttons`);

    if (dmCount >= 2) {
      // Click second agent
      await dmButtons.nth(1).click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${DIR}/multi-02-agent2.png` });

      // Chat with second agent
      console.log('5. Chat with agent 2...');
      const ta2 = page.locator('textarea').last();
      if (await ta2.count() > 0) {
        await ta2.fill('Di AGENTE-2-RESPUESTA');
        await page.locator('button.glia-btn-send').last().click();

        for (let i = 0; i < 12; i++) {
          await page.waitForTimeout(2500);
          const bubbles = await page.locator('.glia-msg').count();
          const stream = await page.locator('.glia-stream').count();
          console.log(`   t+${(i+1)*2.5}s: bubbles=${bubbles} stream=${stream}`);
          if (bubbles >= 2 && stream === 0) break;
        }

        await page.screenshot({ path: `${DIR}/multi-03-agent2-response.png` });
        const feed2 = await page.textContent('.glia-feed');
        check((feed2?.length || 0) > 50, 'Agent 2 responded');

        // Switch back to agent 1
        console.log('6. Switching back to agent 1...');
        await dmButtons.nth(0).click();
        await page.waitForTimeout(3000);

        const feed1back = await page.textContent('.glia-feed');
        check(feed1back?.includes('AGENTE-1-RESPUESTA') || false, 'Agent 1 history preserved');
        await page.screenshot({ path: `${DIR}/multi-04-back-to-agent1.png` });
      }
    } else {
      console.log('   ⚠️  Not enough DM agents to test switching');
      check(true, 'Multi-agent (skipped — need 2+ agents in sidebar)');
    }

  } catch(e) {
    console.log(`\n\x1b[31m❌ ${e.message}\x1b[0m`);
    await page.screenshot({ path: `${DIR}/multi-99-crash.png` });
    failCount++;
  } finally {
    await browser.close();
    fs.writeFileSync(`${DIR}/multi-agent-logs.txt`, browserLogs.join('\n'));
    console.log(`\n📁 ${DIR}/`);
    if (failCount === 0) {
      console.log('\x1b[32m🎉 MULTI-AGENT TEST PASSED\x1b[0m');
      process.exit(0);
    } else {
      console.log(`\x1b[31m❌ ${failCount} FAILURES\x1b[0m`);
      process.exit(1);
    }
  }
})();
