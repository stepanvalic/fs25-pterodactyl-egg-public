import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
function boot(dataDir, toggle) {
  const r = spawnSync('bash', ['-c', 'source "$1"; force_update_prepare || exit 1; echo "$FORCE_UPDATE_ENABLED ${FORCE_UPDATE_NEW} ${INSTALLER_POLICY:-} ${INSTALLER_REFRESH_ID:-}"',
    '--', `${root}/yolk/lib/force-update.sh`],
    {env: {...process.env, DATA_DIR: dataDir, FORCE_UPDATE: toggle, INSTALLER_POLICY: '', INSTALLER_REFRESH_ID: ''}, encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  const [enabled, fresh, policy, id] = r.stdout.trim().split(' ');
  return {enabled, fresh, policy, id};
}

test('toggle requests one update per off -> on change', t => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'fs25-force-'));
  t.after(() => fs.rmSync(data, {recursive: true, force: true}));
  const off = boot(data, 'false');
  assert.equal(off.enabled, '0');
  assert.equal(off.policy, undefined);
  const first = boot(data, 'true');
  assert.deepEqual([first.enabled, first.fresh, first.policy], ['1', '1', 'latest']);
  assert.match(first.id, /^force-1-/);
  const restart = boot(data, 'true');
  assert.equal(restart.fresh, '0');
  assert.equal(restart.id, first.id);
  boot(data, 'false');
  const second = boot(data, 'true');
  assert.equal(second.fresh, '1');
  assert.match(second.id, /^force-2-/);
  assert.equal(fs.readdirSync(data).join(), '.download-state');
});
