import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs25-download-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const sub of ['bin', 'installer', 'dlc', 'data']) fs.mkdirSync(`${dir}/${sub}`);
  fs.copyFileSync(`${root}/tests/fake-curl.sh`, `${dir}/bin/curl`);
  fs.chmodSync(`${dir}/bin/curl`, 0o700);
  fs.writeFileSync(`${dir}/bin/sleep`, '#!/bin/bash\nexit 0\n', {mode: 0o700});
  const env = {...process.env, PATH: `${dir}/bin:${process.env.PATH}`, INSTALLER_DIR: `${dir}/installer`,
    DLC_DIR: `${dir}/dlc`, DATA_DIR: `${dir}/data`, AUTO_DOWNLOAD: 'true', DOWNLOAD_DLC: 'false',
    INSTALLER_POLICY: 'latest', INSTALLER_REFRESH_ID: 'test-1', GAME_SERIAL: 'TEST-NOT-A-LICENSE',
    FAKE_CALLS: `${dir}/calls`, FAKE_FAIL: 'false'};
  return {dir, env};
}
const run = env => spawnSync('bash', [`${root}/yolk/lib/download-game.sh`], {env, encoding: 'utf8', timeout: 10000});
const calls = env => fs.existsSync(env.FAKE_CALLS) ? fs.readFileSync(env.FAKE_CALLS, 'utf8').trim().split('\n').length : 0;
test('default opt-out makes zero network calls', t => {
  const {env} = fixture(t);
  delete env.AUTO_DOWNLOAD;
  assert.equal(run(env).status, 0);
  assert.equal(calls(env), 0);
});
test('current mode respects a single uploaded Setup.exe', t => {
  const {env} = fixture(t);
  fs.writeFileSync(`${env.INSTALLER_DIR}/Setup.exe`, 'test');
  assert.equal(run({...env, INSTALLER_POLICY: 'current'}).status, 0);
  assert.equal(calls(env), 0);
});
test('failed portal submission is never repeated on restart', t => {
  const {env} = fixture(t);
  env.FAKE_FAIL = 'true';
  assert.notEqual(run(env).status, 0);
  assert.equal(calls(env), 1);
  assert.notEqual(run(env).status, 0);
  assert.equal(calls(env), 1);
});
test('latest is downloaded once per explicit ID and old media are preserved', t => {
  const {env} = fixture(t);
  fs.writeFileSync(`${env.INSTALLER_DIR}/FarmingSimulator25_old_ESD.img`, 'old');
  const first = run(env);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.equal(calls(env), 3);
  const selected = fs.readFileSync(`${env.INSTALLER_DIR}/selected-installer`, 'utf8').trim();
  assert.equal(fs.readFileSync(`${env.INSTALLER_DIR}/${selected}`, 'utf8'), 'test');
  assert.ok(fs.existsSync(`${env.INSTALLER_DIR}/${selected}.sha256`));
  assert.equal(fs.readFileSync(`${env.INSTALLER_DIR}/FarmingSimulator25_old_ESD.img`, 'utf8'), 'old');
  assert.equal(run({...env, GAME_SERIAL: ''}).status, 0);
  assert.equal(calls(env), 3);
  assert.equal(run({...env, INSTALLER_REFRESH_ID: 'test-2'}).status, 0);
  assert.equal(calls(env), 6);
  assert.ok(fs.existsSync(`${env.INSTALLER_DIR}/${selected}`));
});
test('interrupted CDN download reuses cached response without the serial', t => {
  const {env} = fixture(t);
  assert.notEqual(run({...env, FAKE_TRANSFER_FAIL: 'true'}).status, 0);
  assert.equal(calls(env), 3);
  assert.equal(run({...env, GAME_SERIAL: ''}).status, 0);
  assert.equal(calls(env), 5);
  assert.equal(run({...env, GAME_SERIAL: ''}).status, 0);
  assert.equal(calls(env), 5);
});
