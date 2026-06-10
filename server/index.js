const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cleanupTempFiles = require('./cleanup');

const app = express();
app.use(cors());
app.use(express.json());

const YT_DLP = 'yt-dlp';
const FFMPEG = 'C:\\ffmpeg\\ffmpeg\\bin\\ffmpeg.exe';

function ytdlpJson(args) {
  return new Promise((resolve, reject) => {
    execFile(YT_DLP, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    console.log("========== STDOUT ==========");
    console.log(stdout);

    console.log("========== STDERR ==========");
    console.log(stderr);
      if (err) return reject(new Error(stderr || err.message));
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject(new Error('Failed to parse yt-dlp output')); }
    });
  });
}

// ─── GET /api/info ───────────────────────────────────────────────────────────
app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const info = await ytdlpJson([
      url, '--dump-json', '--no-playlist', '--no-warnings', '--skip-download',
    ]);

    const allFormats = info.formats || [];

    // Find the best-quality audio-only format (m4a preferred for AAC compatibility)
    const bestAudioFmt = allFormats
      .filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

    const bestAudioId = bestAudioFmt ? bestAudioFmt.format_id : 'bestaudio';

    // Build video format list keyed by height
    const videoFormats = [];
    const seen = new Set();
    const preferredHeights = [2160, 1440, 1080, 720, 480, 360, 240];

    for (const h of preferredHeights) {
      // Find best video-only stream at this height (highest bitrate / tbr)
      const candidates = allFormats.filter(f =>
        f.height === h &&
        f.vcodec && f.vcodec !== 'none'
      ).sort((a, b) => (b.tbr || b.vbr || 0) - (a.tbr || a.vbr || 0));

      const fmt = candidates[0];
      if (fmt && !seen.has(h)) {
        seen.add(h);
        const label = h >= 2160 ? '4K' : h >= 1440 ? '2K' : `${h}p`;

        // Build the yt-dlp format selector:
        // Always: video_format_id + best_audio_id → merged by ffmpeg into mp4
        // Fallback chain ensures we always get both streams
        const fmtSelector =
          `${fmt.format_id}+bestaudio`+         // exact video + exact audio
          `/bestvideo[height=${h}]+bestaudio` +          // fallback: best at height + any audio
          `/bestvideo[height<=${h}]+bestaudio`;          // fallback: ≤ height + any audio

        videoFormats.push({
          fmtSelector,
          quality: label,
          height: h,
          filesize: fmt.filesize || fmt.filesize_approx || null,
          fps: fmt.fps || null,
        });
      }
    }

    // If no explicit heights found, add a "best" catch-all
    if (videoFormats.length === 0) {
      videoFormats.push({
        fmtSelector: 'bestvideo+bestaudio/best',
        quality: 'Best',
        height: null,
        filesize: null,
        fps: null,
      });
    }

    const audioFormats = [
      { fmtSelector: 'bestaudio', quality: '320k', label: 'MP3 — Best Quality' },
      { fmtSelector: 'bestaudio', quality: '192k', label: 'MP3 — Standard' },
      { fmtSelector: 'bestaudio', quality: '128k', label: 'MP3 — Small' },
    ];

    res.json({
      id: info.id,
      title: info.title,
      channel: info.uploader || info.channel || 'Unknown',
      duration: info.duration,
      durationString: info.duration_string,
      viewCount: info.view_count,
      thumbnail: info.thumbnail,
      videoFormats,
      audioFormats,
    });
  } catch (err) {
    console.error('Info error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/download ───────────────────────────────────────────────────────
app.get('/api/download', async (req, res) => {
  const { url, fmtSelector, type, quality } = req.query;
  if (!url || !type) return res.status(400).json({ error: 'Missing parameters' });

  const tmpDir = path.join(__dirname, 'temp');  
  const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2);
  // Use a fixed output path with .mp4 / .mp3 extension directly
  const outputExt = type === 'audio' ? 'mp3' : 'mp4';
  const outputPath = path.join(tmpDir, `${tmpId}.%(ext)s`);

  let ytArgs;

  if (type === 'audio') {
    const bitrate = quality || '192k';
    ytArgs = [
      url,
      '--verbose',
      '--no-playlist',
      '--no-warnings',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', bitrate,
      '--ffmpeg-location', FFMPEG,
      '-o', outputPath,
    ];
  } else {
    // VIDEO: always merge video + audio streams
    // fmtSelector already has "+bestaudio" baked in from /api/info
    const selector = fmtSelector || 'bestvideo+bestaudio/best';

    ytArgs = [
      url,
      '--verbose',
      '--no-playlist',
      '--no-warnings',

      '-f', selector,

      '--remux-video', 'mp4',

      '--ffmpeg-location', FFMPEG,

      '-o', outputPath,
    ];
  }

  console.log(`[download] type=${type} selector=${fmtSelector} quality=${quality}`);
  console.log(`[yt-dlp args]`, ytArgs.join(' '));

  execFile(YT_DLP, ytArgs, { maxBuffer: 100 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
    console.log("========== DOWNLOAD STDOUT ==========");
    console.log(stdout);

    console.log("========== DOWNLOAD STDERR ==========");
    console.log(stderr);
    if (err) {
      console.error('Download error:', stderr);
      return res.status(500).json({ error: 'Download failed: ' + (stderr?.slice(0, 500) || err.message) });
    }

    // yt-dlp may write .mp4 or recode and write a new file; find it
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(tmpId));
    if (!files.length) {
      return res.status(500).json({ error: 'Output file not found after download' });
    }

    // Pick the mp4/mp3 — prefer the exact extension we asked for
    const targetFile = files.find(f => f.endsWith(`.${outputExt}`)) || files[0];
    const filePath = path.join(tmpDir, targetFile);
    console.log("========== FILES FOUND ==========");
    console.log(files);

    console.log("========== TARGET FILE ==========");
    console.log(targetFile);

    console.log("========== FULL PATH ==========");
    console.log(filePath);

    const stat = fs.statSync(filePath);
    const mimeType = outputExt === 'mp3' ? 'audio/mpeg' : 'video/mp4';
    const safeTitle = (req.query.title || 'video').replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 60);
    const filename = `${safeTitle}.${outputExt}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('end', () => { fs.unlink(filePath, () => {}); });
    stream.on('error', (e) => { console.error('Stream error:', e); res.end(); });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ YT Downloader backend on http://localhost:${PORT}`));
