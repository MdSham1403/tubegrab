const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cleanupTempFiles = require('./cleanup');
const { YTDLP, ensureYtDlp, updateYtDlp, startAutoUpdate, withUpdateRetry } = require('./ytdlpUpdater');

// ─── Config (all optional, set as environment variables) ────────────────────
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN;              // e.g. https://tubegrab.vercel.app (comma separated)
const FFMPEG = process.env.FFMPEG_PATH || require('ffmpeg-static') || 'ffmpeg';
const COOKIES_FILE = process.env.YTDLP_COOKIES_FILE;      // optional, helps when YouTube blocks the server IP
const JS_RUNTIME = process.env.YTDLP_JS_RUNTIME;          // e.g. "node" (newer yt-dlp needs a JS runtime for YouTube)
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '2', 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;              // optional, enables POST /admin/update-ytdlp

const TMP_DIR = path.join(os.tmpdir(), 'tubegrab');
fs.mkdirSync(TMP_DIR, { recursive: true });

const app = express();
app.set('trust proxy', 1); // correct client IPs behind Render/Railway proxies
app.use(cors({
  origin: CORS_ORIGIN ? CORS_ORIGIN.split(',').map(s => s.trim()) : true,
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json());
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down and try again in a minute.' },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────
const ALLOWED_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be',
]);

function validateUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
    return u.toString();
  } catch { return null; }
}

// Format selectors look like "137+bestaudio/bestvideo[height<=1080]+bestaudio"
const SELECTOR_RE = /^[A-Za-z0-9_+\-/\[\]<>=,.*]{1,300}$/;

function baseArgs() {
  const args = ['--no-playlist', '--no-warnings', '--ffmpeg-location', FFMPEG];
  if (COOKIES_FILE && fs.existsSync(COOKIES_FILE)) args.push('--cookies', COOKIES_FILE);
  if (JS_RUNTIME) args.push('--js-runtimes', JS_RUNTIME);
  return args;
}

// Runs yt-dlp. Returns { promise, child } so callers can kill it.
function runYtDlp(args, { maxBuffer = 20 * 1024 * 1024, timeout = 10 * 60 * 1000 } = {}) {
  let child;
  const promise = new Promise((resolve, reject) => {
    child = execFile(YTDLP, args, { maxBuffer, timeout }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).slice(0, 600)));
      resolve(stdout);
    });
  });
  return { promise, child };
}

function friendlyError(msg) {
  if (/confirm you.?re not a bot|Sign in to confirm/i.test(msg)) {
    return 'YouTube is blocking this server (bot check). Try again later or run the app locally.';
  }
  if (/Video unavailable|Private video|removed/i.test(msg)) return 'This video is unavailable.';
  return msg;
}

// Simple limit on simultaneous downloads (free hosts have little RAM)
let active = 0;

const ytReady = ensureYtDlp();

// ─── Routes ─────────────────────────────────────────────────────────────────
app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get('/api/info', async (req, res) => {
  const url = validateUrl(req.query.url);
  if (!url) return res.status(400).json({ error: 'Please enter a valid YouTube URL.' });

  try {
    await ytReady;
    const run = () => runYtDlp([...baseArgs(), '--dump-json', '--skip-download', '--', url],
      { timeout: 60 * 1000 }).promise;
    const stdout = await withUpdateRetry(run);
    const info = JSON.parse(stdout);
    const allFormats = info.formats || [];

    const videoFormats = [];
    const seen = new Set();
    for (const h of [2160, 1440, 1080, 720, 480, 360, 240]) {
      const fmt = allFormats
        .filter(f => f.height === h && f.vcodec && f.vcodec !== 'none')
        .sort((a, b) => (b.tbr || b.vbr || 0) - (a.tbr || a.vbr || 0))[0];
      if (!fmt || seen.has(h)) continue;
      seen.add(h);
      videoFormats.push({
        fmtSelector:
          `${fmt.format_id}+bestaudio` +
          `/bestvideo[height=${h}]+bestaudio` +
          `/bestvideo[height<=${h}]+bestaudio`,
        quality: h >= 2160 ? '4K' : h >= 1440 ? '2K' : `${h}p`,
        height: h,
        filesize: fmt.filesize || fmt.filesize_approx || null,
        fps: fmt.fps || null,
      });
    }
    if (videoFormats.length === 0) {
      videoFormats.push({ fmtSelector: 'bestvideo+bestaudio/best', quality: 'Best', height: null, filesize: null, fps: null });
    }

    res.json({
      id: info.id,
      title: info.title,
      channel: info.uploader || info.channel || 'Unknown',
      duration: info.duration,
      durationString: info.duration_string,
      viewCount: info.view_count,
      thumbnail: info.thumbnail,
      videoFormats,
      audioFormats: [
        { fmtSelector: 'bestaudio', quality: '320k', label: 'MP3 — Best Quality' },
        { fmtSelector: 'bestaudio', quality: '192k', label: 'MP3 — Standard' },
        { fmtSelector: 'bestaudio', quality: '128k', label: 'MP3 — Small' },
      ],
    });
  } catch (err) {
    console.error('[info] error:', err.message);
    res.status(500).json({ error: friendlyError(err.message) });
  }
});

app.get('/api/download', async (req, res) => {
  const url = validateUrl(req.query.url);
  const type = req.query.type;
  if (!url) return res.status(400).json({ error: 'Please enter a valid YouTube URL.' });
  if (type !== 'audio' && type !== 'video') return res.status(400).json({ error: 'Invalid type.' });

  const selector = req.query.fmtSelector || 'bestvideo+bestaudio/best';
  if (!SELECTOR_RE.test(selector)) return res.status(400).json({ error: 'Invalid format.' });
  const quality = /^\d{2,3}k$/.test(req.query.quality || '') ? req.query.quality : '192k';

  if (active >= MAX_CONCURRENT) {
    return res.status(503).json({ error: 'Server is busy, please try again in a minute.' });
  }
  active++;

  const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2);
  const outputExt = type === 'audio' ? 'mp3' : 'mp4';
  const outputTemplate = path.join(TMP_DIR, `${tmpId}.%(ext)s`);
  let finalFile = null;
  let currentChild = null;

  const removeTempFiles = () => {
    try {
      for (const f of fs.readdirSync(TMP_DIR)) {
        if (f.startsWith(tmpId)) fs.unlink(path.join(TMP_DIR, f), () => {});
      }
    } catch {}
  };

  // Client left before we finished: stop yt-dlp and clean up
  let released = false;
  const release = () => { if (!released) { released = true; active--; } };
  res.on('close', () => {
    if (!res.writableFinished && currentChild) currentChild.kill('SIGKILL');
    release();
    removeTempFiles();
  });

  try {
    await ytReady;
    const args = type === 'audio'
      ? [...baseArgs(), '-x', '--audio-format', 'mp3', '--audio-quality', quality, '-o', outputTemplate, '--', url]
      : [...baseArgs(), '-f', selector, '--remux-video', 'mp4', '-o', outputTemplate, '--', url];

    const run = () => {
      const { promise, child } = runYtDlp(args, { maxBuffer: 50 * 1024 * 1024, timeout: 10 * 60 * 1000 });
      currentChild = child;
      return promise;
    };
    await withUpdateRetry(run);

    const files = fs.readdirSync(TMP_DIR).filter(f => f.startsWith(tmpId));
    const target = files.find(f => f.endsWith(`.${outputExt}`)) || files[0];
    if (!target) return res.status(500).json({ error: 'Output file not found after download.' });
    finalFile = path.join(TMP_DIR, target);

    const stat = fs.statSync(finalFile);
    const safeTitle = String(req.query.title || 'video').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 60) || 'video';
    res.setHeader('Content-Type', outputExt === 'mp3' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.${outputExt}"`);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(finalFile);
    stream.on('error', (e) => { console.error('[stream] error:', e.message); res.destroy(); });
    stream.pipe(res); // temp files are removed in res 'close'
  } catch (err) {
    console.error('[download] error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Download failed: ' + friendlyError(err.message) });
    else res.destroy();
  }
});

// Optional manual trigger: POST /admin/update-ytdlp with header "x-admin-token"
app.post('/admin/update-ytdlp', async (req, res) => {
  if (!ADMIN_TOKEN || req.get('x-admin-token') !== ADMIN_TOKEN) return res.status(403).json({ error: 'Forbidden' });
  const ok = await updateYtDlp();
  res.json({ ok });
});

// ─── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ TubeGrab backend running on port ${PORT}`);
  startAutoUpdate(6);                                   // refresh yt-dlp every 6 hours
  cleanupTempFiles(TMP_DIR);
  setInterval(() => cleanupTempFiles(TMP_DIR), 15 * 60 * 1000).unref();
});
