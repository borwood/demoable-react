import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(root, 'demo-dist');
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(directory + sep)) throw new Error('Outside static root');
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
let browser;
try {
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  console.log(`Owned in-process screenshot HTTP handle: pid=${process.pid}, started=${new Date().toISOString()}, root=${directory}, port=${server.address().port}`);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', { name: 'Start inspecting', exact: true }).click();
  await page.getByRole('button', { name: 'Pin Counter', exact: true }).click();
  await page.getByRole('button', { name: 'Explain the interaction', exact: true }).click();
  await page.getByRole('button', { name: 'Count: 0', exact: true }).click();
  await page.evaluate(() => document.querySelector('.demoable-react-app').scrollTo(0, 170));
  await page.waitForTimeout(5100);
  await expect(page.locator('[data-demoable-ui=context]')).toContainText('counter belongs');
  await mkdir(resolve(root, 'docs/images'), { recursive: true });
  await page.screenshot({ path: resolve(root, 'docs/images/inspection-pinned.png') });
  await page.evaluate(() => document.querySelector('.demoable-react-app').scrollTo(0, 700));
  await page.getByRole('button', { name: 'Pin Delivery group', exact: true }).click();
  await page.getByRole('button', { name: 'Inspection settings', exact: true }).click();
  await page.getByRole('slider', { name: 'Info and settings background opacity', exact: true }).fill('0.9');
  await expect(page.locator('[data-demoable-ui=context]')).toHaveCSS('background-color', 'rgba(250, 248, 255, 0.9)');
  await expect(page.locator('.demoable-react-context-body')).toHaveCSS('color', 'rgb(37, 32, 52)');
  await page.screenshot({ path: resolve(root, 'docs/images/inspection-settings.png') });
  console.log('Captured authentic pinned counter and group/settings states at 1440x1000.');
} finally {
  if (browser) await browser.close();
  await new Promise((done, reject) => { server.close(error => error ? reject(error) : done()); server.closeAllConnections(); });
  console.log('Cleanup: screenshot browser and exact in-process HTTP handles closed.');
}
