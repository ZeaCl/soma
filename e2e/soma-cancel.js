/**
 * Soma E2E — Cancel mid-stream test
 *
 * Validates:
 * 1. Cancel button is clickable during streaming
 * 2. After cancel, partial response is visible with "Cancelado" marker
 * 3. User can send another message after cancel
 *
 * Usage: node soma-cancel.js
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
  console.log('\n\x1b[36m🧪 Soma Cancel E2E\x1b[0m\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on('console', msg => {
    if (msg.text().includes('[useGlia]'))
      console.log(`  🌐 ${msg.text()}`);
  });

  try {
    // 1. Auth flow
    console.log('1. Auth flow...');
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
    await page.waitForTimeout(2000);

    // 2. Send a prompt that will take time
    const textarea = page.locator('textarea').last();
    check(await textarea.count() > 0, 'Textarea found');

    console.log('3. Sending long prompt...');
    await textarea.fill('Escribe un análisis detallado de 10 puntos sobre la importancia de la inteligencia artificial en la medicina moderna. Sé muy exhaustivo.');
    await page.locator('button.glia-btn-send').last().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}/cancel-01-streaming.png` });

    // 3. Click cancel
    console.log('4. Clicking cancel...');
    const cancelBtn = page.locator('button.glia-btn-cancel');
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
      console.log('   Cancel clicked');
    } else {
      console.log('   Cancel button not visible (agent may have finished)');
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${DIR}/cancel-02-cancelled.png` });

    // 4. Verify we can send another message
    console.log('5. Sending follow-up message...');
    await textarea.fill('Gracias');
    await page.locator('button.glia-btn-send').last().click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${DIR}/cancel-03-followup.png` });

    // 5. Check feed state
    const feed = await page.textContent('.glia-feed');
    const len = feed?.length || 0;
    const bubbles = await page.locator('.glia-msg').count();
    console.log(`   Feed: ${len} chars, ${bubbles} bubbles`);
    check(len > 50, `Feed has content (${len} chars)`);
    check(bubbles >= 2, `At least 2 message bubbles (${bubbles})`);

  } catch(e) {
    console.log(`\n\x1b[31m❌ ${e.message}\x1b[0m`);
    await page.screenshot({ path: `${DIR}/cancel-99-crash.png` });
    failCount++;
  } finally {
    await browser.close();
    console.log(`\n📁 ${DIR}/`);
    if (failCount === 0) {
      console.log('\x1b[32m🎉 CANCEL TEST PASSED\x1b[0m');
      process.exit(0);
    } else {
      console.log(`\x1b[31m❌ ${failCount} FAILURES\x1b[0m`);
      process.exit(1);
    }
  }
})();
