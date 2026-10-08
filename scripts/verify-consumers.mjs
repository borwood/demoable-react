import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, copyFile, rm, realpath, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import { verifyCancellationDemo } from './events-demo-browser.mjs';
import { inspectionFixture, verifyInspection, verifyMobileAndHint } from './inspection-browser.mjs';
import { eventsFixture, verifyEvents, verifyEventsTouch } from './events-browser.mjs';

import { surfaceFixture, verifySurface, verifySurfaceDemo } from './surface-browser.mjs';

import {qa2Fixture,verifyQa2} from './qa2-browser.mjs';
import { verifyReleaseExamples } from './release-browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const browserMode = process.argv.includes('--browser');
const fixtureOnly = process.argv.includes('--fixture-only');
const npmCli = process.env.npm_execpath;
assert(npmCli, 'Run through npm run test:consumer or npm run test:browser');
function npm(args, cwd, capture = false) {
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `npm ${args.join(' ')} failed: ${result.stderr ?? ''}`);
  return result.stdout;
}
const temporary = await mkdtemp(join(tmpdir(), 'demoable-react-consumers-'));
assert(resolve(temporary).startsWith(resolve(tmpdir()) + sep + 'demoable-react-consumers-'));
console.log(`Owned temporary consumer root: ${temporary}`);
const servers = [];
const browsers = [];
async function serve(directory) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      const target = resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!target.startsWith(directory + sep)) { response.writeHead(403); response.end(); return; }
      const data = await readFile(target);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      response.writeHead(200, { 'Content-Type': types[extname(target)] ?? 'application/octet-stream' });
      response.end(data);
    } catch { response.writeHead(404); response.end(); }
  });
  servers.push(server);
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(`Owned in-process HTTP handle: ${url} -> ${directory}`);
  return url;
}
try {
  const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', temporary], root, true))[0];
  const expectedFiles = ['LICENSE', 'README.md', 'dist/index.d.ts', 'dist/inspection.d.ts', 'dist/events.d.ts', 'dist/event-log.d.ts', 'dist/demo-layout.d.ts', 'dist/instrumentation.d.ts', 'dist/index.js', 'dist/styles.css', 'package.json'];
  for (const directory of ['docs/api', 'docs/images', 'skills/agent', 'skills/claude']) {
    for (const file of await readdir(join(root, directory), { recursive: true, withFileTypes: true })) {
      if (file.isFile()) expectedFiles.push(join(file.parentPath, file.name).slice(root.length).replaceAll('\\', '/'));
    }
  }
  expectedFiles.push('docs/integration-skills.md', 'docs/examples.md', 'demo/App.tsx', 'demo/app.css');
  assert.deepEqual(packed.files.map(file => file.path).sort(), expectedFiles.sort(), 'tarball must expose only approved distribution files');
  const tarball = join(temporary, packed.filename);
  const targets = [];
  for (const [version, reactTypes, domTypes] of [['18.3.1', '18.3.31', '18.3.7'], ['19.3.0', '19.3.0', '19.3.0']]) {
    const directory = join(temporary, `react-${version}`);
    await mkdir(directory);
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name: `consumer-react-${version}`, private: true, type: 'module', scripts: { typecheck: 'tsc --noEmit', build: 'vite build' }, dependencies: { '@borwood/demoable-react': `file:${tarball.replaceAll('\\', '/')}`, react: version, 'react-dom': version }, devDependencies: { typescript: metadata.devDependencies.typescript, vite: metadata.devDependencies.vite, '@types/react': reactTypes, '@types/react-dom': domTypes } }, null, 2));
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM'], types: ['vite/client'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, noEmit: true }, include: ['*.tsx'] }));
    await copyFile(join(root, 'skills', 'agent', 'integrate-demoable-react', 'assets', 'demo', 'App.tsx'), join(directory, 'App.tsx'));
    await writeFile(join(directory, 'InspectionFixture.tsx'), inspectionFixture);
    await writeFile(join(directory, 'EventsFixture.tsx'), eventsFixture);
    await writeFile(join(directory, 'SurfaceFixture.tsx'), surfaceFixture);
    await writeFile(join(directory, 'Qa2Fixture.tsx'), qa2Fixture);
    await copyFile(join(root, 'skills', 'agent', 'integrate-demoable-react', 'assets', 'demo', 'app.css'), join(directory, 'app.css'));
    await writeFile(join(directory, 'main.tsx'), `import { createRoot } from 'react-dom/client';\nimport { App } from './App';\nimport { InspectionFixture } from './InspectionFixture';\nimport { EventsFixture } from './EventsFixture';\nimport { SurfaceFixture } from './SurfaceFixture';\nimport { Qa2Fixture } from './Qa2Fixture';\nconst params = new URLSearchParams(location.search);\nif (!params.has('fixture') && !params.has('events') && !params.has('surface') && !params.has('qa2')) await import('./app.css');\ncreateRoot(document.getElementById('root')!).render(params.has('qa2') ? <Qa2Fixture /> : params.has('surface') ? <SurfaceFixture /> : params.has('events') ? <EventsFixture /> : params.has('fixture') ? <InspectionFixture /> : <App />);\n`);
    await writeFile(join(directory, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="UTF-8"/><title>Isolated consumer</title><style>[data-testid="theme-probe"] { color: var(--demoable-react-accent); }</style></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
    npm(['install', '--no-audit', '--no-fund'], directory);
    const installed = join(directory, 'node_modules', ...metadata.name.split('/'));
    const installedMetadata = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
    assert.equal(installedMetadata.name, '@borwood/demoable-react');
    assert.equal(installedMetadata.version, '0.1.0');
    assert.equal(installedMetadata.private, undefined);
    assert.equal(installedMetadata.license, 'MIT');
    assert.deepEqual(installedMetadata.repository, { type: 'git', url: 'git+https://github.com/borwood/demoable-react.git' });
    assert.equal(installedMetadata.homepage, 'https://github.com/borwood/demoable-react#readme');
    assert.deepEqual(installedMetadata.bugs, { url: 'https://github.com/borwood/demoable-react/issues' });
    assert.deepEqual(installedMetadata.publishConfig, { access: 'public', registry: 'https://registry.npmjs.org/', tag: 'latest' });
    assert.equal(await readFile(join(installed, 'LICENSE'), 'utf8'), await readFile(join(root, 'LICENSE'), 'utf8'));
    assert.match(await readFile(join(installed, 'LICENSE'), 'utf8'), /Copyright \(c\) 2026 borwood/);
    assert((await realpath(installed)).startsWith(directory + sep), 'installed package must not resolve to repository source');
    for (const platform of ['agent', 'claude']) {
      const skill = join(installed, 'skills', platform, 'integrate-demoable-react');
      assert.equal(await readFile(join(skill, 'assets/demo/App.tsx'), 'utf8'), await readFile(join(directory, 'App.tsx'), 'utf8'));
      assert.equal(await readFile(join(skill, 'assets/demo/app.css'), 'utf8'), await readFile(join(directory, 'app.css'), 'utf8'));
    }
    for (const name of ['react', 'react-dom']) {
      const pkg = JSON.parse(await readFile(join(directory, 'node_modules', name, 'package.json'), 'utf8'));
      assert.equal(pkg.version, version);
    }
    // Compile the portable scaffold itself before the broader fixture entrypoint.
    const scaffold = join(installed, 'skills/agent/integrate-demoable-react/assets/demo');
    const saved = new Map();
    try {
      for (const name of ['main.tsx', 'index.html', 'tsconfig.json']) {
        saved.set(name, await readFile(join(directory, name)));
        await copyFile(join(scaffold, name), join(directory, name));
      }
      npm(['run', 'typecheck'], directory);
      npm(['run', 'build', '--', '--outDir', 'standalone-dist'], directory);
      console.log(`PASS complete portable scaffold React ${version}`);
    } finally {
      for (const [name, content] of saved) await writeFile(join(directory, name), content);
    }
    const published = await import(pathToFileURL(join(installed, 'dist/index.js')).href);
    assert.deepEqual(published.packageInfo, { name: metadata.name, version: metadata.version });
    assert.deepEqual(Object.keys(published).sort(), ['packageInfo', 'DemoLayout', 'OrientationPanel', 'InspectionProvider', 'Inspectable', 'useInspection', 'useInspectable', 'useInspectionGroup', 'useOccupiedRegion', 'useEvents', 'createEventStore', 'EventLog', 'trackPromise', 'instrumentHandler'].sort());
    npm(['run', 'typecheck'], directory);
    npm(['run', 'build'], directory);
    console.log(`PASS isolated tarball React/DOM ${version}; types ${reactTypes}/${domTypes}`);
    if (browserMode) targets.push({ name: `React ${version} consumer`, url: await serve(join(directory, 'dist')), fixture: true });
  }
  if (browserMode) {
    if (!fixtureOnly) targets.push({ name: 'inspection demo', url: await serve(join(root, 'demo-dist')) });
    for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
      const browser = await engine.launch();
      browsers.push(browser);
      console.log(`Browser ${name}: ${browser.version()}`);
      for (const target of targets) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('requestfailed', request => errors.push(request.failure()?.errorText));
        if (!fixtureOnly) {
        await page.goto(target.url);
        await expect(page.getByText('Component inspection', { exact: true }).first()).toBeVisible();
        await expect(page.getByTestId('package-info')).toHaveText(`${metadata.name} · ${metadata.version}`);
        await expect(page.getByTestId('theme-probe')).toHaveCSS('color', 'rgb(114, 86, 216)');
        const unscopedToken = await page.locator('body').evaluate(element => getComputedStyle(element).getPropertyValue('--demoable-react-accent'));
        assert.equal(unscopedToken, '', 'theme token must not leak outside opt-in scope');
        await page.getByRole('button', { name: 'Count: 0', exact: true }).click();
        await page.getByRole('button', { name: 'Count: 1', exact: true }).press('Enter');
        await expect(page.getByRole('button', { name: 'Count: 2', exact: true })).toBeVisible();
        await verifySurfaceDemo(page, target.url);
        await verifyCancellationDemo(page, target.url);
        await verifyReleaseExamples(page, target.url);
        }
        if (target.fixture) {
          await verifyInspection(page, target.url);
          await verifyMobileAndHint(browser, target.url);
          await verifyEvents(page, target.url);
          await verifyEventsTouch(browser, target.url);
          await verifySurface(page, target.url);
          await verifyQa2(page, target.url);
        }
        assert.deepEqual(errors, [], `${name}: ${target.name} browser errors`);
        await page.close();
        console.log(`PASS ${name}: ${target.name} ${fixtureOnly ? 'inspection fixture' : 'metadata, scoped CSS, pointer + keyboard counter'}, no browser errors`);
      }
      await browser.close();
      browsers.pop();
    }
  }
} finally {
  const cleanup = await Promise.allSettled([
    ...browsers.map(browser => browser.close()),
    ...servers.map(server => new Promise((done, reject) => {
      server.close(error => error ? reject(error) : done());
      server.closeAllConnections();
    })),
  ]);
  // The exact mkdtemp path was bounded to the OS temporary directory above.
  await rm(temporary, { recursive: true, force: true });
  const failures = cleanup.filter(result => result.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Owned resource cleanup failed');
  console.log('Cleanup complete: owned browser handles closed, HTTP handles closed, temporary consumers removed.');
}
