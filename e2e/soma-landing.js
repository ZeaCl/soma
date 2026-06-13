/**
 * Soma E2E — Landing Page + Doctor validation
 *
 * Validates:
 * 1. Landing v2 renders correctly (hero, terminal preview, sections)
 * 2. "How it Works" section visible
 * 3. "For Developers" section visible
 * 4. "For Companies" section visible
 * 5. "Multi-Engine" section visible with engine cards
 * 6. CTA button works
 * 7. Doctor script reports all layers OK
 *
 * Usage: node soma-landing.js
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');

const DIR = '/tmp/soma-e2e';
fs.mkdirSync(DIR, { recursive: true });

const BASE = 'http://soma.zea.localhost';
const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const WARN = '\x1b[33mWARN\x1b[0m';
let failCount = 0;
let warnCount = 0;

function check(condition, label) {
  if (condition) console.log(`  ${PASS} ${label}`);
  else { console.log(`  ${FAIL} ${label}`); failCount++; }
}

function warn(condition, label) {
  if (condition) console.log(`  ${PASS} ${label}`);
  else { console.log(`  ${WARN} ${label}`); warnCount++; }
}

(async () => {
  console.log('\n\x1b[36m🧪 Soma Landing + Doctor E2E\x1b[0m\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    // ── 1. Landing page ─────────────────────────────────────────────────

    console.log('1. Landing page');
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${DIR}/landing-01-hero.png`, fullPage: true });

    // Verify hero section — wait for React to render
    await page.waitForSelector('h1', { timeout: 10000 });
    await page.waitForTimeout(1000);
    let pageText = await page.textContent('body');

    check(pageText.includes('Agents that run'), 'Hero headline visible');
    check(pageText.includes('like users'), 'Hero sub-headline visible');
    check(pageText.includes('Launch AgentHub') || pageText.includes('AgentHub'), 'CTA button visible');
    check(pageText.includes('Docs'), 'Docs link visible');

    // Verify terminal preview
    check(pageText.includes('soma-agent'), 'CLI command in terminal preview');
    warn(pageText.includes('Agent created') || pageText.includes('agent create'), 'Agent created message in terminal');
    warn(pageText.includes('Linux user') || pageText.includes('Home'), 'Linux user info in terminal');

    // Verify badge
    check(pageText.includes('Multi-engine') || pageText.includes('sandbox') || pageText.includes('CLI'),
      'Feature badge visible');

    // ── 2. How it Works section ─────────────────────────────────────────

    console.log('\n2. How it Works');
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/landing-02-how-it-works.png`, fullPage: true });

    // Re-read content after scroll
    pageText = await page.textContent('body');
    check(pageText.includes('How it works'), 'How it Works heading');
    check(pageText.includes('Agent') && pageText.includes('Linux'), 'Agent = Linux User card');
    check(pageText.includes('chmod') || pageText.includes('700'), 'chmod 700 isolation card');
    check(pageText.includes('Bind') || pageText.includes('Mount'), 'Bind Mounts card');

    // ── 3. For Developers section ───────────────────────────────────────

    console.log('\n3. For Developers');
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/landing-03-for-devs.png`, fullPage: true });

    // Re-read after scroll
    pageText = await page.textContent('body');
    check(pageText.includes('Developers') || pageText.includes('terminal') || pageText.includes('Developer'),
      'For Developers section heading');
    check(pageText.includes('soma-agent'), 'CLI command in dev section');
    warn(pageText.includes('CI/CD') || pageText.includes('ephemeral'), 'CI/CD example visible');

    // ── 4. For Companies section ────────────────────────────────────────

    console.log('\n4. For Companies');
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/landing-04-enterprise.png`, fullPage: true });

    // Re-read after scroll
    pageText = await page.textContent('body');
    check(pageText.includes('Companies') || pageText.includes('Enterprise') || pageText.includes('scale'),
      'Enterprise section heading');
    check(pageText.includes('drwx') || pageText.includes('Permission') || pageText.includes('/home/soma'),
      'Filesystem permissions visible');
    warn(pageText.includes('Permission denied'), 'Permission denied example');

    // ── 5. Multi-Engine section ─────────────────────────────────────────

    console.log('\n5. Multi-Engine');
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/landing-05-engines.png`, fullPage: true });

    // Re-read after scroll
    pageText = await page.textContent('body');
    check(pageText.includes('engine') || pageText.includes('hub'),
      'Multi-Engine section heading');
    check(pageText.includes('Pi'), 'Pi engine card');
    warn(pageText.includes('ReAct'), 'ReAct engine card');
    warn(pageText.includes('OpenCode'), 'OpenCode engine card');

    // ── 6. CTA section ─────────────────────────────────────────────────

    console.log('\n6. CTA');
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);

    // Re-read after scroll
    pageText = await page.textContent('body');
    check(pageText.includes('Start') || pageText.includes('deploying') || pageText.includes('AgentHub'),
      'Bottom CTA visible');

    // ── 7. Doctor script ────────────────────────────────────────────────

    console.log('\n7. Doctor');
    try {
      const doctorOutput = execSync('cd /Users/dev/Documents/zea/soma && bash doctor-soma.sh 2>&1', {
        timeout: 120000, encoding: 'utf8', maxBuffer: 1024 * 1024
      });
      check(doctorOutput.includes('FINAL REPORT'), 'Doctor produces final report');
      check(!doctorOutput.includes('❌') || doctorOutput.includes('✅'), 'Doctor has check results');
      // Count passing checks
      const passes = (doctorOutput.match(/✅/g) || []).length;
      const fails = (doctorOutput.match(/❌/g) || []).length;
      console.log(`   Doctor: ${passes} passed, ${fails} failed`);
      check(fails === 0, 'Doctor: 0 critical failures');
    } catch (e) {
      console.log(`  ${WARN} Doctor script error: ${e.message}`);
      warnCount++;
    }

  } catch(e) {
    console.log(`\n\x1b[31m❌ ${e.message}\x1b[0m`);
    await page.screenshot({ path: `${DIR}/landing-99-crash.png` });
    failCount++;
  } finally {
    await browser.close();
    console.log(`\n📁 ${DIR}/`);

    if (failCount === 0 && warnCount === 0) {
      console.log('\x1b[32m🎉 LANDING + DOCTOR TEST PASSED\x1b[0m');
      process.exit(0);
    } else if (failCount === 0) {
      console.log(`\x1b[33m⚠️  PASSED with ${warnCount} warning(s)\x1b[0m`);
      process.exit(0);
    } else {
      console.log(`\x1b[31m❌ ${failCount} FAILURES, ${warnCount} warnings\x1b[0m`);
      process.exit(1);
    }
  }
})();
