const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');

const DIR = '/tmp/soma-e2e';
fs.mkdirSync(DIR, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: `${DIR}/${name}`, fullPage: false });
  console.log('📸 ' + name);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  let errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  try {
    // 1. Soma landing
    console.log('1️⃣  Landing');
    await page.goto('http://soma.zea.localhost');
    await page.waitForTimeout(1500);
    await shot(page, '01-landing.png');

    // 2. Click Get Started
    console.log('2️⃣  Get Started');
    await page.locator('button').filter({ hasText: /Launch|Get Started|AgentHub|Sign in|AgentHub/ }).first().click();
    await page.waitForTimeout(3000);

    // 3. Login if needed
    if (page.url().includes('login')) {
      console.log('3️⃣  Login');
      await page.fill('input[name="session[email]"]', 'c@zea.cl');
      await page.fill('input[name="session[password]"]', '2Infinit0');
      await shot(page, '02-login.png');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }

    // 4. Consent + Authorize
    if (page.url().includes('authorize')) {
      console.log('4️⃣  Authorize');
      await shot(page, '03-consent.png');
      await page.locator('button[value="approve"]').click();
      await page.waitForTimeout(4000);
    }

    // 5. Should be on Soma chat
    if (!page.url().includes('soma.zea.localhost')) {
      await page.goto('http://soma.zea.localhost');
      await page.waitForTimeout(2000);
    }
    console.log('5️⃣  Soma chat: ' + page.url());
    await shot(page, '04-chat.png');

    // 6. Send message to agent
    console.log('6️⃣  Send message');
    const textarea = page.locator('textarea').last();
    if (await textarea.count() > 0) {
      await textarea.fill('Hola, ¿qué puedes hacer?');
      await shot(page, '05-typed.png');
      await page.locator('button.glia-btn-send').last().click();
      console.log('   Sent!');
    }

    // 7. Wait for response
    console.log('7️⃣  Wait for agent response...');
    let responded = false;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(3000);
      const feed = await page.textContent('.glia-feed');
      const len = feed?.length || 0;
      console.log(`   ${(i+1)*3}s: feed=${len} chars`);
      if (len > 200) {
        responded = true;
        break;
      }
    }

    await shot(page, '06-response.png');
    
    if (responded) {
      console.log('\n🎉 AGENT RESPONDED!');
    } else {
      console.log('\n⚠️ No response detected in feed');
    }

    // Report
    const cspErrs = errors.filter(e => e.includes('Content-Security'));
    console.log(`\n📊 CSP errors: ${cspErrs.length} | Total: ${errors.length}`);
    console.log(`📁 Screenshots: ${DIR}/`);

  } catch(e) {
    console.log('❌', e.message);
    await shot(page, '99-error.png');
  } finally {
    await browser.close();
  }
})();
