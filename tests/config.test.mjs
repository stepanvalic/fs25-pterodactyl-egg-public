import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs25-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return {dir, env: {...process.env, GAME_DIR: `${dir}/game`, DEDI_DIR: `${dir}/data`,
    FS25_CONFIG: `${root}/yolk/config`, WEB_PASSWORD: 'test-only-password',
    SERVER_NAME: `A&B <farm> "test"`, REGENERATE_CONFIG: 'false'}};
}
const run = env => spawnSync(process.execPath, [`${root}/yolk/lib/configure.mjs`], {env, encoding: 'utf8'});
test('initial XML escapes operator input and has private permissions', t => {
  const {env} = fixture(t);
  assert.equal(run(env).status, 0);
  const file = `${env.DEDI_DIR}/dedicatedServerConfig.xml`;
  assert.match(fs.readFileSync(file, 'utf8'), /A&amp;B &lt;farm&gt; &quot;test&quot;/);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});
test('restart preserves panel game config byte for byte', t => {
  const {env} = fixture(t);
  assert.equal(run(env).status, 0);
  const file = `${env.DEDI_DIR}/dedicatedServerConfig.xml`;
  fs.writeFileSync(file, '<gameserver><mods/><custom>keep me</custom></gameserver>');
  assert.equal(run({...env, SERVER_NAME: 'changed'}).status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), '<gameserver><mods/><custom>keep me</custom></gameserver>');
});
test('explicit reset backs up existing config', t => {
  const {env} = fixture(t);
  assert.equal(run(env).status, 0);
  const original = fs.readFileSync(`${env.DEDI_DIR}/dedicatedServerConfig.xml`, 'utf8');
  assert.equal(run({...env, REGENERATE_CONFIG: 'true', SERVER_NAME: 'reset'}).status, 0);
  const backup = fs.readdirSync(env.DEDI_DIR).find(name => name.endsWith('.bak'));
  assert.equal(fs.readFileSync(path.join(env.DEDI_DIR, backup), 'utf8'), original);
});
test('rejects oversized game password and default web password', t => {
  const {env} = fixture(t);
  assert.notEqual(run({...env, GAME_PASSWORD: 'x'.repeat(17)}).status, 0);
  assert.notEqual(run({...env, WEB_PASSWORD: 'changeme'}).status, 0);
});
test('egg uses own image, safe download defaults and password limits', () => {
  const egg = JSON.parse(fs.readFileSync(`${root}/egg-farming-simulator-25.json`));
  assert.equal(egg.meta.version, 'PTDL_v2');
  assert.ok(Object.values(egg.docker_images).every(v => v.startsWith('ghcr.io/stepanvalic/')));
  const vars = Object.fromEntries(egg.variables.map(v => [v.env_variable, v]));
  assert.equal(vars.AUTO_DOWNLOAD.default_value, 'false');
  assert.equal(vars.KEEP_INSTALLER.default_value, 'true');
  assert.match(vars.GAME_PASSWORD.rules, /max:16/);
});
