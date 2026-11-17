// Keeps yt-dlp fresh. YouTube changes often, so an old yt-dlp stops working.
//
// Linux (e.g. Render): downloads the official standalone binary into server/bin/
//   on first boot, then refreshes it on a schedule and after failures.
// Windows / macOS (local dev): uses the `yt-dlp` on your PATH and tries `yt-dlp -U`.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const BIN_DIR = path.join(__dirname, 'bin');
const IS_LINUX = process.platform === 'linux';
const LOCAL_BIN = path.join(BIN_DIR, 'yt-dlp');
const ASSET = process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
const DOWNLOAD_URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ASSET}`;

const YTDLP = process.env.YTDLP_PATH || (IS_LINUX ? LOCAL_BIN : 'yt-dlp');

let lastUpdateAt = 0;
let updating = null;

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, args, { timeout: 120000 }, (err, stdout, stderr) =>
      err ? reject(new Error(stderr || err.message)) : resolve(stdout.trim())
    );
  });
}

async function downloadBinary() {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const res = await fetch(DOWNLOAD_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000) throw new Error('Downloaded file looks too small');
  const tmp = LOCAL_BIN + '.tmp';
  fs.writeFileSync(tmp, buf, { mode: 0o755 });
  fs.renameSync(tmp, LOCAL_BIN); // atomic swap, safe even while yt-dlp is running
}

async function doUpdate() {
  try {
    if (IS_LINUX && !process.env.YTDLP_PATH) await downloadBinary();
    else await run(['-U']);
    const v = await run(['--version']);
    lastUpdateAt = Date.now();
    console.log(`[yt-dlp] up to date, version ${v}`);
    return true;
  } catch (e) {
    console.error('[yt-dlp] update failed:', e.message.slice(0, 300));
    return false;
  }
}

// Only one update at a time; callers share the same promise.
function updateYtDlp() {
  if (!updating) updating = doUpdate().finally(() => { updating = null; });
  return updating;
}

// Make sure a usable yt-dlp exists. Resolves once ready (or failed).
async function ensureYtDlp() {
  try {
    const v = await run(['--version']);
    console.log(`[yt-dlp] found version ${v}`);
    updateYtDlp(); // refresh in the background
  } catch {
    console.log('[yt-dlp] not found, installing...');
    await updateYtDlp();
  }
}

function startAutoUpdate(hours = 6) {
  setInterval(updateYtDlp, hours * 3600 * 1000).unref();
}

// Run a job; if it fails, update yt-dlp once (max once per 10 min) and retry.
async function withUpdateRetry(job) {
  try {
    return await job();
  } catch (err) {
    if (Date.now() - lastUpdateAt < 10 * 60 * 1000) throw err;
    console.log('[yt-dlp] job failed, updating and retrying once...');
    if (await updateYtDlp()) return job();
    throw err;
  }
}

module.exports = { YTDLP, ensureYtDlp, updateYtDlp, startAutoUpdate, withUpdateRetry };
