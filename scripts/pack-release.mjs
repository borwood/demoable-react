import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function npm(args, cwd) {
  assert(process.env.npm_execpath, 'Run through npm run pack:release or a package verification script');
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `npm ${args.join(' ')} failed: ${result.stderr}`);
  return JSON.parse(result.stdout)[0];
}

// npm owns file selection. Only its selected files enter the isolated staging root;
// the source README is never written, renamed or temporarily swapped.
export async function packRelease({ root, destination }) {
  root = await realpath(root);
  destination = await realpath(destination);
  assert((await stat(destination)).isDirectory(), 'Pack destination must be an existing directory');
  const temporary = await mkdtemp(join(tmpdir(), 'demoable-release-'));
  assert(resolve(temporary).startsWith(resolve(tmpdir()) + sep + 'demoable-release-'));
  try {
    const selected = npm(['pack', '--dry-run', '--json', '--ignore-scripts'], root);
    for (const { path } of selected.files) {
      const source = await realpath(resolve(root, path));
      const target = resolve(temporary, path);
      assert(source.startsWith(root + sep) && target.startsWith(temporary + sep), 'Package file must stay within its root');
      await mkdir(dirname(target), { recursive: true });
      await copyFile(source, target);
    }
    await copyFile(join(root, 'docs/npm/README.md'), join(temporary, 'README.md'));
    const packed = npm(['pack', '--json', '--ignore-scripts', '--pack-destination', destination], temporary);
    return { ...packed, tarball: join(destination, packed.filename) };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv.length === 3, 'Usage: npm run pack:release -- <existing-output-directory>');
  console.log(JSON.stringify(await packRelease({ root: fileURLToPath(new URL('../', import.meta.url)), destination: resolve(process.argv[2]) }), null, 2));
}
