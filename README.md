# TubeGrab — YouTube Downloader

Full-stack YouTube downloader. Downloads video **with audio** by using `yt-dlp` + `ffmpeg` to merge streams.

## Prerequisites

| Tool | Install |
|------|---------|
| Node.js 18+ | https://nodejs.org |
| Python 3 | (usually pre-installed) |
| yt-dlp | `pip install yt-dlp` |
| ffmpeg | See below |

### Install ffmpeg

**Ubuntu / Debian:**
```bash
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH.

---

## Setup & Run

```bash
# 1. Install all dependencies
npm run install:all
npm install   # installs concurrently

# 2. Start both servers (backend :3001, frontend :5173)
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## How it works

1. **`/api/info`** — runs `yt-dlp --dump-json` to get video metadata + available formats
2. **`/api/download`** — runs `yt-dlp` with:
   - **Video:** `-f "formatId+bestaudio" --merge-output-format mp4` → ffmpeg merges best video + best audio into a single MP4
   - **Audio:** `-x --audio-format mp3 --audio-quality 320k` → extracts and converts to MP3
3. The merged file is streamed directly to the browser as a download

## Deploy (Railway)

Backend is a plain Express app — deploy `server/` to Railway.  
Frontend is a Vite app — deploy `client/` to Vercel, set `VITE_API_URL` to your Railway backend URL and update the proxy in `vite.config.js`.
