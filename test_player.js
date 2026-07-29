const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  page.on('requestfailed', request => {
    console.log('Failed:', request.url(), request.failure().errorText);
  });
  page.on('response', response => {
    if(response.url().includes('m3u8') || response.url().includes('.ts') || response.status() >= 400) {
      console.log('Response:', response.url(), response.status());
    }
  });
  await page.goto('https://embed.st/embed/admin/ppv-chelsea-vs-western-sydney-wanderers/1', { waitUntil: 'networkidle' });
  console.log('Loaded iframe page. Waiting a few seconds...');
  await page.waitForTimeout(5000);
  await browser.close();
})();
