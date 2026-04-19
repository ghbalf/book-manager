const { importFromCalibre } = require('./import-calibre');
const { updateCalibreMetadata } = require('./update-calibre-metadata');
const { getConfig } = require('./config');

// Single-user, in-memory job coordinator. Only one sync may run at a time.
// SSE subscribers receive progress events until the job ends.

const state = {
  running: false,
  kind: null,        // 'sync' | 'rescan'
  subscribers: new Set(),
  lastProgress: null,
};

function broadcast(event) {
  state.lastProgress = event;
  for (const sub of state.subscribers) {
    sub(event);
  }
}

function subscribe(send) {
  state.subscribers.add(send);
  if (state.lastProgress) send(state.lastProgress);
  if (!state.running) send({ type: 'idle' });
  return () => state.subscribers.delete(send);
}

function isRunning() {
  return state.running;
}

async function runSync() {
  if (state.running) {
    const err = new Error('Sync already running');
    err.code = 'ALREADY_RUNNING';
    throw err;
  }
  state.running = true;
  state.kind = 'sync';
  state.lastProgress = null;

  try {
    const { calibrePath } = getConfig();
    broadcast({ type: 'start', kind: 'sync', calibrePath });

    const importResult = await importFromCalibre({
      calibrePath,
      onProgress: (p) => broadcast({ type: 'progress', ...p }),
    });
    broadcast({ type: 'phase-done', phase: 'import', ...importResult });

    const metaResult = await updateCalibreMetadata({
      calibrePath,
      ids: importResult.ids,
      onProgress: (p) => broadcast({ type: 'progress', ...p }),
    });
    broadcast({ type: 'phase-done', phase: 'metadata', ...metaResult });

    broadcast({ type: 'done', kind: 'sync', import: importResult, metadata: metaResult });
  } catch (err) {
    broadcast({ type: 'error', message: err.message });
    throw err;
  } finally {
    state.running = false;
    state.kind = null;
  }
}

async function runRescan() {
  if (state.running) {
    const err = new Error('Sync already running');
    err.code = 'ALREADY_RUNNING';
    throw err;
  }
  state.running = true;
  state.kind = 'rescan';
  state.lastProgress = null;

  try {
    const { calibrePath } = getConfig();
    broadcast({ type: 'start', kind: 'rescan', calibrePath });

    const metaResult = await updateCalibreMetadata({
      calibrePath,
      onProgress: (p) => broadcast({ type: 'progress', ...p }),
    });
    broadcast({ type: 'phase-done', phase: 'metadata', ...metaResult });
    broadcast({ type: 'done', kind: 'rescan', metadata: metaResult });
  } catch (err) {
    broadcast({ type: 'error', message: err.message });
    throw err;
  } finally {
    state.running = false;
    state.kind = null;
  }
}

module.exports = { runSync, runRescan, subscribe, isRunning };
