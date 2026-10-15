import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { packRelease } from './pack-release.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'demoable-release-test-'));
assert(resolve(temporary).startsWith(resolve(tmpdir()) + sep + 'demoable-release-test-'));
const original = await readFile(join(root, 'README.md'));
try {
  const packed = await packRelease({root, destination:temporary});
  const extracted = spawnSync('tar', ['-xOf', packed.tarball, 'package/README.md'], {encoding:'utf8'});
  assert.equal(extracted.status, 0, extracted.stderr);
  assert.equal(extracted.stdout, await readFile(join(root,'docs/npm/README.md'),'utf8'), 'AC001/002: actual archive root README must equal npm-specific copy');
  assert.deepEqual(await readFile(join(root,'README.md')), original, 'repository README preserved after success');
  const blocked = join(temporary, 'blocked');
  await mkdir(join(blocked, packed.filename), {recursive:true});
  await assert.rejects(packRelease({root, destination:blocked}), /npm pack.*failed/s);
  assert.deepEqual(await readFile(join(root,'README.md')), original, 'repository README preserved after pack failure');
  console.log('PASS AC001/002/004: actual archive README exact; source README preserved on success and failure.');
} finally {
  assert.deepEqual(await readFile(join(root,'README.md')), original, 'source README preserved even on test failure');
  await rm(temporary,{recursive:true,force:true});
}
