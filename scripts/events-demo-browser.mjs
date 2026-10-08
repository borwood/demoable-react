import assert from 'node:assert/strict';
import { expect, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Exercise actual demo controls, not a synthetic event-store fixture. */
export async function verifyCancellationDemo(page, url) {
  const failures = [];
  for (const scenario of ['idle', 'finished', 'running']) {
    try {
      await page.goto(url);
      await page.getByRole('button', { name: 'Start inspecting', exact: true }).click();
      const log = page.getByRole('region', { name: 'Live events' });
      await expect(page.getByRole('button', { name: 'Show a cancelled event', exact: true })).toHaveCount(1);
      await expect(page.getByText('Adds a cancelled event to the log. It does not stop running work.', { exact: true })).toBeVisible();
      if (scenario !== 'idle') {
        await page.getByRole('button', { name: 'Run overlapping work', exact: true }).click();
        if (scenario === 'finished') await expect(log.locator('article').filter({ hasText: 'Send delivery' }).locator('[data-state]')).toHaveText('succeeded');
      }
      await page.getByRole('button', { name: 'Show a cancelled event', exact: true }).click();
      console.log(`Cancellation ${scenario}:`, await log.locator('article').allTextContents());
      await expect(log.locator('[data-state="cancelled"]')).toHaveCount(1, { timeout: 1200 });
      await expect(page.getByRole('status')).toHaveText('Cancellation recorded (1). Other application work continues.');
      await expect(page.getByRole('status')).toBeVisible();
      if (scenario === 'running') {
        await expect(log.locator('article').filter({ hasText: 'Send delivery' }).locator('[data-state]')).toHaveText('succeeded');
        await expect(page.getByText('Application results: 1.', { exact: true })).toBeVisible();
        await expect(log.locator('[data-state="cancelled"]')).toHaveCount(1);
      }
      await page.getByRole('button', { name: 'Show a cancelled event', exact: true }).click();
      await expect(log.locator('[data-state="cancelled"]')).toHaveCount(2);
      await expect(page.getByRole('status')).toHaveText('Cancellation recorded (2). Other application work continues.');
    } catch (error) { failures.push(new Error(`${scenario}: ${error.message}`)); }
  }
  // Hidden inspection still acknowledges the user's action locally.
  await page.goto(url);
  await page.getByRole('button', { name: 'Show a cancelled event', exact: true }).click();
  try {
    await expect(page.getByRole('status')).toHaveText('Cancellation recorded (1). Other application work continues.', { timeout: 1200 });
    await expect(page.getByRole('region', { name: 'Live events' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Start inspecting', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Live events' }).locator('[data-state="cancelled"]')).toHaveCount(1);
  } catch (error) { failures.push(new Error(`hidden: ${error.message}`)); }
  assert.equal(failures.length, 0, failures.map(error => error.message).join('\n'));
  console.log('PASS actual demo cancellation: idle, finished, running, repeated and hidden; independent work completes normally.');
}

if (process.argv.includes('--local')) {
  const directory = resolve(fileURLToPath(new URL('../', import.meta.url)), 'demo-dist');
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      const target = resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!target.startsWith(directory + sep)) throw Error('Outside static root');
      const data = await readFile(target);
      response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(target)] ?? 'application/octet-stream');
      response.end(data);
    } catch { response.writeHead(404); response.end(); }
  });
  let browser;
  try {
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    console.log(`Owned cancellation HTTP handle: pid=${process.pid}, root=${directory}, port=${server.address().port}`);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    await verifyCancellationDemo(page, `http://127.0.0.1:${server.address().port}`);
  } finally {
    await browser?.close();
    await new Promise(done => { server.close(done); server.closeAllConnections(); });
    console.log('Closed owned cancellation browser and HTTP handles.');
  }
}
