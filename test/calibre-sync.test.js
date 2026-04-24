const test = require('node:test');
const assert = require('node:assert/strict');

// Resolve target + dependencies up front so we can swap in mocks before any
// real module is loaded. calibre-sync holds module-level state, so each test
// reloads the module after wiring its mocks.
const SYNC_PATH = require.resolve('../calibre-sync');
const IMPORT_PATH = require.resolve('../import-calibre');
const UPDATE_PATH = require.resolve('../update-calibre-metadata');
const CONFIG_PATH = require.resolve('../config');

// Mock function handles get rebound per test; installMockModules wires the
// cache entries to dispatch through these holders.
const mocks = {
  importFromCalibre: null,
  updateCalibreMetadata: null,
  getConfig: () => ({ calibrePath: '/tmp/fake' }),
};

function fakeModule(id, exports) {
  return { id, filename: id, loaded: true, exports, children: [], paths: [] };
}

function installMockModules() {
  require.cache[IMPORT_PATH] = fakeModule(IMPORT_PATH, {
    importFromCalibre: (...args) => mocks.importFromCalibre(...args),
  });
  require.cache[UPDATE_PATH] = fakeModule(UPDATE_PATH, {
    updateCalibreMetadata: (...args) => mocks.updateCalibreMetadata(...args),
  });
  require.cache[CONFIG_PATH] = fakeModule(CONFIG_PATH, {
    getConfig: () => mocks.getConfig(),
  });
}

function freshSync() {
  delete require.cache[SYNC_PATH];
  installMockModules();
  return require('../calibre-sync');
}

function clearMockModules() {
  delete require.cache[SYNC_PATH];
  delete require.cache[IMPORT_PATH];
  delete require.cache[UPDATE_PATH];
  delete require.cache[CONFIG_PATH];
}

test.afterEach(() => {
  clearMockModules();
  mocks.importFromCalibre = null;
  mocks.updateCalibreMetadata = null;
  mocks.getConfig = () => ({ calibrePath: '/tmp/fake' });
});

test('isRunning is false on a fresh module', () => {
  const sync = freshSync();
  assert.equal(sync.isRunning(), false);
});

test('subscribe on a fresh module sends {type:"idle"} and returns an unsubscribe fn', () => {
  const sync = freshSync();
  const received = [];
  const unsubscribe = sync.subscribe((ev) => received.push(ev));
  assert.deepEqual(received, [{ type: 'idle' }]);
  assert.equal(typeof unsubscribe, 'function');
  unsubscribe();
});

test('subscribe after a terminal replay does NOT also send idle', async () => {
  mocks.importFromCalibre = async () => ({ ids: [1, 2] });
  mocks.updateCalibreMetadata = async () => ({ updated: 2 });
  const sync = freshSync();
  await sync.runSync();

  const received = [];
  sync.subscribe((ev) => received.push(ev));

  // A completed sync's lastProgress is {type:'done', ...}. The replay should
  // send exactly that and stop — no spurious idle. This is the bug that caused
  // ERR_STREAM_WRITE_AFTER_END on SSE resubscribe.
  assert.equal(received.length, 1);
  assert.equal(received[0].type, 'done');
  assert.equal(sync.isRunning(), false);
});

test('unsubscribe removes the subscriber from future broadcasts', async () => {
  mocks.importFromCalibre = async ({ onProgress }) => {
    onProgress({ step: 'scan' });
    return { ids: [] };
  };
  mocks.updateCalibreMetadata = async () => ({ updated: 0 });
  const sync = freshSync();

  const received = [];
  const unsubscribe = sync.subscribe((ev) => received.push(ev));
  received.length = 0; // ignore replay
  unsubscribe();

  await sync.runSync();
  assert.equal(received.length, 0, 'unsubscribed listener must not receive further events');
});

test('runSync broadcasts start → progress → phase-done → done and flips isRunning', async () => {
  mocks.importFromCalibre = async ({ onProgress }) => {
    onProgress({ step: 'import', processed: 1 });
    return { ids: [10, 11], added: 2 };
  };
  mocks.updateCalibreMetadata = async ({ onProgress }) => {
    onProgress({ step: 'metadata', processed: 1 });
    return { updated: 2 };
  };
  mocks.getConfig = () => ({ calibrePath: '/books' });

  const sync = freshSync();
  const received = [];
  sync.subscribe((ev) => received.push(ev));
  received.length = 0; // drop initial idle

  await sync.runSync();

  const types = received.map((e) => e.type);
  assert.deepEqual(types, [
    'start',
    'progress',
    'phase-done',
    'progress',
    'phase-done',
    'done',
  ]);
  assert.equal(received[0].calibrePath, '/books');
  assert.equal(received[0].kind, 'sync');
  assert.equal(sync.isRunning(), false);
});

test('runSync broadcasts {type:"error"} and rethrows when import fails', async () => {
  mocks.importFromCalibre = async () => { throw new Error('calibre db locked'); };
  mocks.updateCalibreMetadata = async () => { throw new Error('should not be reached'); };

  const sync = freshSync();
  const received = [];
  sync.subscribe((ev) => received.push(ev));
  received.length = 0;

  await assert.rejects(sync.runSync(), /calibre db locked/);

  const errorEvent = received.find((e) => e.type === 'error');
  assert.ok(errorEvent, 'error event must be broadcast');
  assert.equal(errorEvent.message, 'calibre db locked');
  assert.equal(sync.isRunning(), false, 'running flag must be cleared even on failure');
});

test('concurrent runSync rejects with code ALREADY_RUNNING', async () => {
  // Hold importFromCalibre pending so the first runSync stays active while
  // we attempt the second. The deferred resolver lets us release it after
  // the concurrency assertion.
  let release;
  mocks.importFromCalibre = () => new Promise((resolve) => { release = () => resolve({ ids: [] }); });
  mocks.updateCalibreMetadata = async () => ({ updated: 0 });

  const sync = freshSync();
  const first = sync.runSync();
  assert.equal(sync.isRunning(), true);

  await assert.rejects(sync.runSync(), (err) => {
    assert.equal(err.code, 'ALREADY_RUNNING');
    return true;
  });

  release();
  await first;
  assert.equal(sync.isRunning(), false);
});

test('runRescan skips the import phase and only runs metadata', async () => {
  let importCalled = false;
  mocks.importFromCalibre = async () => { importCalled = true; return { ids: [] }; };
  mocks.updateCalibreMetadata = async () => ({ updated: 7 });

  const sync = freshSync();
  const received = [];
  sync.subscribe((ev) => received.push(ev));
  received.length = 0;

  await sync.runRescan();

  assert.equal(importCalled, false);
  const types = received.map((e) => e.type);
  assert.deepEqual(types, ['start', 'phase-done', 'done']);
  assert.equal(received[0].kind, 'rescan');
});
