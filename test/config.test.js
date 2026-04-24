const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const CONFIG_MODULE_PATH = require.resolve('../config');

// config.js caches on the module scope. Tests must reset both the in-memory
// cache and the disk file to stay independent.
function reloadConfigModule() {
  delete require.cache[CONFIG_MODULE_PATH];
  return require('../config');
}

let snapshot = null;

test.before(() => {
  if (fs.existsSync(CONFIG_PATH)) {
    snapshot = fs.readFileSync(CONFIG_PATH, 'utf-8');
  }
});

test.after(() => {
  if (snapshot !== null) {
    fs.writeFileSync(CONFIG_PATH, snapshot);
  } else if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
  }
});

test.beforeEach(() => {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
  delete require.cache[CONFIG_MODULE_PATH];
});

test('getConfig returns defaults when no config.json exists', () => {
  const { getConfig } = reloadConfigModule();
  const cfg = getConfig();
  assert.equal(cfg.defaultLanguage, 'en');
  assert.equal(cfg.coverLookupDelayMs, 200);
  assert.ok(cfg.calibrePath, 'calibrePath default should be set');
  assert.ok(cfg.coversDir, 'coversDir default should be set');
});

test('getConfig merges disk values over defaults', () => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    defaultLanguage: 'de',
    coverLookupDelayMs: 500,
  }));
  const { getConfig } = reloadConfigModule();
  const cfg = getConfig();
  assert.equal(cfg.defaultLanguage, 'de');
  assert.equal(cfg.coverLookupDelayMs, 500);
  assert.ok(cfg.calibrePath, 'defaults still fill missing keys');
});

test('setConfig writes to disk and returns the merged result', () => {
  const { setConfig } = reloadConfigModule();
  const returned = setConfig({ defaultLanguage: 'de', coverLookupDelayMs: 42 });
  assert.equal(returned.defaultLanguage, 'de');
  assert.equal(returned.coverLookupDelayMs, 42);

  const onDisk = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  assert.equal(onDisk.defaultLanguage, 'de');
  assert.equal(onDisk.coverLookupDelayMs, 42);
});

test('setConfig ignores keys not in EDITABLE_KEYS', () => {
  const { setConfig, EDITABLE_KEYS } = reloadConfigModule();
  assert.ok(!EDITABLE_KEYS.includes('dbPassword'), 'guard: dbPassword must not be editable');

  const returned = setConfig({ dbPassword: 'hunter2', defaultLanguage: 'de' });
  assert.equal(returned.defaultLanguage, 'de');
  assert.equal(returned.dbPassword, undefined);

  const onDisk = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  assert.equal(onDisk.dbPassword, undefined);
});

test('setConfig round-trips through a fresh module load', () => {
  // First module instance: write.
  const first = reloadConfigModule();
  first.setConfig({ defaultLanguage: 'de', coverLookupDelayMs: 123 });

  // Second instance reads from disk, bypassing the cache from the first.
  const second = reloadConfigModule();
  const cfg = second.getConfig();
  assert.equal(cfg.defaultLanguage, 'de');
  assert.equal(cfg.coverLookupDelayMs, 123);
});

test('load() ignores malformed JSON and falls back to defaults', () => {
  fs.writeFileSync(CONFIG_PATH, '{ not json');
  const { getConfig } = reloadConfigModule();
  // Swallowed parse error goes to console.error; we care that getConfig
  // returns usable defaults rather than throwing.
  const cfg = getConfig();
  assert.equal(cfg.defaultLanguage, 'en');
});

test('getDbInfo never exposes a password field', () => {
  const { getDbInfo } = reloadConfigModule();
  const info = getDbInfo();
  assert.equal(info.password, undefined);
  assert.ok(info.host);
  assert.ok(info.database);
});
