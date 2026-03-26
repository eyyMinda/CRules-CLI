const https = require('https');
const fs = require('fs');
const path = require('path');
const { CLI_BASE_DIR } = require('./config');

const CACHE_PATH = path.join(CLI_BASE_DIR, '.version-check.json');
const CACHE_MS = 24 * 60 * 60 * 1000;
const REGISTRY_HOST = 'registry.npmjs.org';
const REGISTRY_PATH = '/crules-cli/latest';
const TIMEOUT_MS = 4000;

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m'
};

function readCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(latest) {
  try {
    if (!fs.existsSync(CLI_BASE_DIR)) {
      fs.mkdirSync(CLI_BASE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ checkedAt: Date.now(), latest }) + '\n', 'utf8');
  } catch {
    // ignore cache write failures
  }
}

function fetchLatestVersion() {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: REGISTRY_HOST,
        path: REGISTRY_PATH,
        method: 'GET',
        timeout: TIMEOUT_MS,
        headers: { Accept: 'application/json' }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }
          try {
            const j = JSON.parse(raw);
            resolve(typeof j.version === 'string' ? j.version : null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/** True if semver-like `a` is strictly newer than `b` (numeric dot parts only). */
function versionNewer(a, b) {
  if (!a || !b || a === b) return false;
  const pa = a.split('.').map((x) => parseInt(String(x).replace(/^\D+/, ''), 10) || 0);
  const pb = b.split('.').map((x) => parseInt(String(x).replace(/^\D+/, ''), 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function paint(text, code, useColor) {
  if (!useColor) return text;
  return `${code}${text}${ansi.reset}`;
}

/**
 * If npm has a newer crules-cli than this install, print a short colored hint on stderr.
 * Respects `quiet`; skips when CI is set. Uses a daily cache under ~/.crules-cli.
 */
async function maybePrintUpdateNotice({ quiet } = {}) {
  if (quiet || process.env.CI) return;

  let pkg;
  try {
    pkg = require('../package.json');
  } catch {
    return;
  }
  const current = pkg.version;
  const now = Date.now();
  const cached = readCache();
  let latest = cached && typeof cached.latest === 'string' ? cached.latest : null;

  const stale = !cached || !cached.checkedAt || now - cached.checkedAt > CACHE_MS;
  if (stale) {
    const fetched = await fetchLatestVersion();
    if (fetched) {
      latest = fetched;
      writeCache(fetched);
    } else if (latest) {
      writeCache(latest);
    } else {
      return;
    }
  }

  if (!latest || !versionNewer(latest, current)) return;

  const useColor = process.stderr.isTTY === true;
  const dim = (s) => paint(s, ansi.dim, useColor);
  const yellow = (s) => paint(s, ansi.yellow, useColor);

  console.error('');
  console.error(`${yellow(`↳ New version on npm: ${latest}`)}${dim(` (installed ${current})`)}`);
  console.error(dim('  npm install -g crules-cli@latest'));
  console.error('');
}

module.exports = { maybePrintUpdateNotice, compareSemverGreater: versionNewer };
