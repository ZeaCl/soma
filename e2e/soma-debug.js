const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');

const DIR = '/tmp/soma-e2e';
fs.mkdirSync(DIR, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: `${DIR}/${name}`, fullPage: false });
}

(async () => {
  const browser = await chromium.launch({ headless: true, slowMo: 100 });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  let logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  
  try {
    // 1. Landing → Get Started
    await page.goto('http://soma.zea.localhost');
    await page.waitForTimeout(1000);
    await shot(page, '01-landing.png');
    console.log('1. Landing');
    
    await page.locator('button').filter({ hasText: /Launch|Get Started|AgentHub/ }).first().click();
    await page.waitForTimeout(3000);
    
    // 2. Login
    if (page.url().includes('login')) {
      console.log('2. Login');
      await page.fill('input[name="session[email]"]', 'test@example.com');
      await page.fill('input[name="session[password]"]', 'test_password_123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }
    
    // 3. Consent
    if (page.url().includes('authorize')) {
      console.log('3. Consent');
      await shot(page, '02-consent.png');
      await page.locator('button[value="approve"]').click();
      await page.waitForTimeout(4000);
    }
    
    // 4. Soma chat
    if (!page.url().includes('soma.zea.localhost')) {
      await page.goto('http://soma.zea.localhost');
      await page.waitForTimeout(2000);
    }
    console.log('4. Chat page: ' + page.url());
    await shot(page, '03-chat.png');
    
    // 5. Send message and monitor state
    const ta = page.locator('textarea').last();
    if (await ta.count() > 0) {
      console.log('5. Sending message...');
      await ta.fill('Responde OK');
      await page.locator('.glia-btn-send').last().click();
      await shot(page, '04-sent.png');
      
      // Monitor feed content every 2 seconds for 60 seconds
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(2000);
        const messages = await page.locator('.glia-msg').count();
        const bubbles = await page.locator('.glia-bubble').count();
        const feed = await page.textContent('.glia-feed');
        const len = feed?.length || 0;
        const visible = await page.locator('.glia-feed').isVisible();
        console.log(`  t+${(i+1)*2}s: msgs=${messages} bubbles=${bubbles} feed=${len} visible=${visible}`);
        
        if (len > 200 && messages > 1) {
          await shot(page, '05-responded.png');
          console.log('✅ Agent responded!');
          break;
        }
        // Check if feed went blank
        if (i > 3 && len < 50 && messages === 0) {
          await shot(page, `05-blank-t${(i+1)*2}s.png`);
          console.log('⚠️ FEED WENT BLANK at t=' + ((i+1)*2) + 's');
          // Capture relevant logs
          const recentLogs = logs.filter(l => l.includes('error') || l.includes('glia') || l.includes('WebSocket'));
          console.log('Recent errors:', recentLogs.slice(-5));
          break;
        }
      }
      await shot(page, '06-final.png');
    }
    
    // Dump console errors
    const errors = logs.filter(l => l.includes('[error]'));
    console.log('\n📋 Console errors:');
    errors.forEach(e => console.log('  ' + e.substring(0, 150)));
    
  } catch(e) {
    console.log('❌', e.message);
    await shot(page, '99-crash.png');
  } finally {
    await browser.close();
    console.log('\n📁 ' + DIR + '/');
  }
})();
