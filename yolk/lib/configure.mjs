import fs from 'node:fs';
import path from 'node:path';

const env = process.env;
const defaults = {
  WEB_PORT: '7999', WEB_USERNAME: 'admin', WEB_PASSWORD: '',
  SERVER_NAME: 'FS25 Server', ADMIN_PASSWORD: '', GAME_PASSWORD: '',
  SAVEGAME_INDEX: '1', MAX_PLAYERS: '12', SERVER_PORT: '10823',
  SERVER_LANGUAGE: 'cz', AUTO_SAVE_INTERVAL: '15.000000',
  STATS_INTERVAL: '360.000000', CROSSPLAY: 'true', PAUSE_IF_EMPTY: '2', MAP_ID: 'MapUS',
};
const values = Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, env[k] ?? v]));
values.LANGUAGE = values.SERVER_LANGUAGE;
if (!values.WEB_PASSWORD || values.WEB_PASSWORD === 'changeme') {
  throw new Error('Set a non-default WEB_PASSWORD before starting.');
}
const gameConfig = path.join(env.DEDI_DIR, 'dedicatedServerConfig.xml');
const preserve = env.REGENERATE_CONFIG !== 'true' && fs.existsSync(gameConfig);
if (!preserve) {
  for (const key of ['ADMIN_PASSWORD', 'GAME_PASSWORD']) {
    if (values[key].length > 16) throw new Error(`${key} must be at most 16 characters.`);
  }
}
const escape = value => value.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[c]));
function render(template, destination) {
  const source = fs.readFileSync(path.join(env.FS25_CONFIG, template), 'utf8');
  const xml = source.replace(/%%([A-Z_]+)%%/g, (_, key) => {
    if (!(key in values)) throw new Error(`Unknown configuration placeholder: ${key}`);
    return escape(values[key]);
  });
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(`${destination}.tmp`, xml, {mode: 0o600});
  fs.renameSync(`${destination}.tmp`, destination);
}
// Web credentials/port follow Startup variables; game settings belong to the GIANTS panel.
render('dedicatedServer.xml.tmpl', path.join(env.GAME_DIR, 'dedicatedServer.xml'));
if (preserve) {
  console.log('[fs25/config] Keeping game settings, selected mods and savegame.');
} else {
  if (fs.existsSync(gameConfig)) fs.copyFileSync(gameConfig, `${gameConfig}.${Date.now()}.bak`);
  render('dedicatedServerConfig.xml.tmpl', gameConfig);
  console.log('[fs25/config] Game settings initialized from Startup variables.');
}
