# TubeGrab — YouTube Downloader

Full-stack YouTube downloader (React + Express). Uses `yt-dlp` + `ffmpeg` to merge best video and audio into one MP4, or extract MP3.

For personal use. Respect YouTube's Terms of Service and copyright law.

## What's included
- **Auto-updating yt-dlp**: on Linux the server downloads the latest yt-dlp on first start, refreshes it every 6 hours, and updates + retries once if a download fails. Locally it uses the `yt-dlp` on your PATH.
- **No manual ffmpeg install**: bundled through `ffmpeg-static`.
- Safer server: YouTube-only URL validation, input checks, rate limiting, concurrency cap, temp-file cleanup, CORS control.

## Run locally
Requirements: Node.js 18+, and `yt-dlp` on your PATH (Windows: `winget install yt-dlp`, or `pip install -U yt-dlp`).

```bash
npm run install:all
npm install
npm run dev
```
Open http://localhost:5173 (backend on :3001).

## Deploy free (no Docker)

### 1) Backend on Render
1. Push this repo to GitHub.
2. Render → **New → Web Service** → pick the repo (or use **Blueprint** with `render.yaml`).
3. Settings: Root Directory `server`, Build `npm install`, Start `node index.js`, Instance **Free**.
4. Environment: `YTDLP_JS_RUNTIME=node`, `CORS_ORIGIN=<your frontend URL>`.
5. Copy the service URL, e.g. `https://tubegrab-api.onrender.com`.

### 2) Frontend on Vercel or Netlify
1. Import the repo, Root Directory `client`, build `npm run build`, output `dist`.
2. Environment variable: `VITE_API_URL=https://tubegrab-api.onrender.com`
3. Deploy, then put that URL into `CORS_ORIGIN` on Render.

### Free-tier notes
- Render's free service sleeps after ~15 min idle; the first request takes 30–50 s. yt-dlp is refreshed on every wake-up.
- 512 MB RAM: try short videos / 720p first.
- YouTube often blocks datacenter IPs ("confirm you're not a bot"). If so, either run locally or set `YTDLP_COOKIES_FILE` (Render → Secret Files) using a throwaway account.

## Environment variables (server)
See `server/.env.example`.
