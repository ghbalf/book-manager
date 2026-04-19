const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULTS = {
  calibrePath: path.join(os.homedir(), 'Documents', 'Calibre Library'),
  coversDir: path.join(__dirname, 'covers'),
  defaultLanguage: 'en',
  coverLookupDelayMs: 200,
};

// Only these keys can be set through the API.
const EDITABLE_KEYS = Object.keys(DEFAULTS);

let cache = null;

function load() {
  if (cache) return cache;
  let fromDisk = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fromDisk = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch (err) {
      console.error(`Error parsing ${CONFIG_PATH}, using defaults:`, err.message);
    }
  }
  cache = { ...DEFAULTS, ...fromDisk };
  return cache;
}

function save(next) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + '\n');
  cache = next;
}

function getConfig() {
  return { ...load() };
}

function setConfig(patch) {
  const current = load();
  const next = { ...current };
  for (const key of EDITABLE_KEYS) {
    if (patch[key] !== undefined) {
      next[key] = patch[key];
    }
  }
  save(next);
  return { ...next };
}

// Non-secret DB info for display. Never includes the password.
function getDbInfo() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bookmanager',
    user: process.env.DB_USER || 'postgres',
  };
}

module.exports = { getConfig, setConfig, getDbInfo, EDITABLE_KEYS };
