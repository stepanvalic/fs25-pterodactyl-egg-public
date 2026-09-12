import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs25-install-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const env = {...process.env, INSTALLER_DIR: `${dir}/installer`, GAME_DIR: `${dir}/prefix/game`,
    WINEPREFIX: `${dir}/prefix`, DATA_DIR: `${dir}/data`, DOCS_DIR: `${dir}/data`,
    DLC_DIR: `${dir}/dlc`, KEEP_INSTALLER: 'true', PATH: `${dir}/bin:${process.env.PATH}`};
  for (const p of [env.INSTALLER_DIR, env.GAME_DIR, env.DATA_DIR, env.DLC_DIR, `${dir}/bin`]) fs.mkdirSync(p, {recursive: true});
  fs.writeFileSync(`${env.INSTALLER_DIR}/Setup.exe`, 'fixture');
  fs.writeFileSync(`${env.DOCS_DIR}/fixture.dat`, 'fixture');
  fs.writeFileSync(`${dir}/bin/winepath`, '#!/bin/bash\nprintf "%s\\n" "$2"\n', {mode: 0o755});
  fs.writeFileSync(`${dir}/bin/wine`, `#!/bin/bash
echo fixture-wine-output
for arg in "$@"; do
  case "$arg" in /LOG=*) printf 'fixture-setup-output\\n' > "$(printf %s "$arg" | cut -c6-)" ;; esac
done
[ "$FAIL_SETUP" = 1 ] && exit 42
mkdir -p "$GAME_DIR/x64"
for file in dedicatedServer.exe FarmingSimulator2025.exe x64/FarmingSimulator2025Game.exe dataS.gar; do
  printf fixture > "$GAME_DIR/$file"
done
`, {mode: 0o755});
  return {dir, env};
}
const run = env => spawnSync('bash', [`${root}/yolk/lib/install-game.sh`], {env, encoding: 'utf8', timeout: 15000});

test('setup failure keeps incomplete marker and persistent diagnostics', t => {
  const {env} = fixture(t);
  const r = run({...env, FAIL_SETUP: '1'});
  assert.equal(r.status, 1, r.stderr);
  assert.ok(fs.existsSync(`${env.INSTALLER_DIR}/.install-incomplete`));
  assert.match(r.stderr, /stage=setup exit=42/);
  assert.match(r.stdout + r.stderr, /NOT necessarily the Wings/);
  const logs = fs.readdirSync(`${env.DATA_DIR}/install-logs`);
  for (const suffix of ['-disk.log', '-setup.log', '-wine.log']) assert.ok(logs.some(p => p.endsWith(suffix)));
  assert.ok(fs.existsSync(`${env.INSTALLER_DIR}/Setup.exe`));
});

test('successful setup clears marker and retains installer', t => {
  const {env} = fixture(t);
  const r = run(env);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(`${env.INSTALLER_DIR}/.install-incomplete`));
  assert.ok(fs.existsSync(`${env.INSTALLER_DIR}/Setup.exe`));
  assert.match(r.stdout, /License files already present/);
});

test('dedicatedServer.exe alone is not a complete legacy installation', t => {
  const {env} = fixture(t);
  fs.writeFileSync(`${env.GAME_DIR}/dedicatedServer.exe`, 'partial');
  const r = spawnSync('bash', ['-c', 'source "$1"; base_game_files_present', '--', `${root}/yolk/lib/install-debug.sh`], {env});
  assert.notEqual(r.status, 0);
});

test('interrupted extraction is retried instead of using partial Setup.exe', t => {
  const {env, dir} = fixture(t);
  fs.writeFileSync(`${env.INSTALLER_DIR}/.extract-incomplete`, '');
  fs.writeFileSync(`${env.INSTALLER_DIR}/FarmingSimulator25_test_ESD.img`, 'fixture');
  fs.writeFileSync(`${dir}/bin/7z`, '#!/bin/bash\necho fixture-extraction-error >&2\nexit 7\n', {mode: 0o755});
  const r = run(env);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /stage=extract exit=7/);
  assert.ok(fs.existsSync(`${env.INSTALLER_DIR}/.extract-incomplete`));
  assert.ok(!fs.existsSync(`${env.GAME_DIR}/dedicatedServer.exe`));
});
