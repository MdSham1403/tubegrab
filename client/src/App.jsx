import React, { useState, useRef } from 'react'

// In production set VITE_API_URL to your backend URL (no trailing slash). Locally the Vite proxy handles /api.
const API = ((import.meta.env.VITE_API_URL || '').replace(/\/$/, '')) + '/api'

function formatBytes(bytes) {
  if (!bytes) return null
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' KB'
}

function formatViews(n) {
  if (!n) return null
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B views'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M views'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K views'
  return n + ' views'
}

const s = {
  // Page layout
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center' },

  // Hero
  hero: { width: '100%', padding: '3rem 1.5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden',
    background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,0,0,0.1) 0%, transparent 70%)' },
  logoRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: '0.6rem' },
  ytIcon: { width: 42, height: 42, background: 'var(--red)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: 'Bebas Neue, sans-serif', fontSize: '2.5rem', letterSpacing: 3, lineHeight: 1 },
  brandRed: { color: 'var(--red)' },
  tagline: { fontSize: 13, color: 'var(--muted)', fontWeight: 300, letterSpacing: 0.3, marginBottom: '1.8rem' },

  // Input bar
  bar: { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, padding: '5px 5px 5px 16px', maxWidth: 640, margin: '0 auto 0.75rem', gap: 8, transition: 'border-color 0.2s' },
  barInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 14, padding: '8px 0' },
  pasteBtn: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted)',
    fontSize: 12, padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap' },
  analyzeBtn: (loading) => ({
    background: loading ? 'rgba(255,0,0,0.5)' : 'var(--red)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 500,
    padding: '10px 20px', borderRadius: 10, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
    transition: 'all 0.15s', opacity: loading ? 0.8 : 1 }),

  // Body
  body: { width: '100%', maxWidth: 680, padding: '1.5rem 1.25rem', flex: 1 },

  // States
  loadingBox: { textAlign: 'center', padding: '3rem 1rem' },
  spinner: { width: 38, height: 38, border: '3px solid rgba(255,255,255,0.08)', borderTopColor: 'var(--red)',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 1rem' },
  loadingMsg: { fontSize: 13, color: 'var(--muted)', fontWeight: 300 },

  // Result card
  resultCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden',
    animation: 'fadeIn 0.3s ease' },
  videoMeta: { display: 'flex', gap: 14, padding: '1.2rem', alignItems: 'flex-start' },
  thumbWrap: { width: 136, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: '#333',
    aspectRatio: '16/9', position: 'relative' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  videoInfoCol: { flex: 1, minWidth: 0 },
  videoTitle: { fontSize: 14, fontWeight: 500, lineHeight: 1.45, marginBottom: 8,
    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  metaRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  metaChip: { fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 },
  divider: { height: 1, background: 'var(--border)' },

  // Format section
  fmtSec: { padding: '1.1rem 1.2rem' },
  fmtHeader: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 10, fontWeight: 500 },
  tabRow: { display: 'flex', gap: 6, marginBottom: 12 },
  tab: (active) => ({
    fontSize: 12, padding: '5px 14px', borderRadius: 8, border: active ? '1px solid var(--red-border)' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'var(--red-dim)' : 'transparent', color: active ? '#FF7777' : 'var(--muted)', transition: 'all 0.15s' }),

  fmtList: { display: 'flex', flexDirection: 'column', gap: 6 },
  fmtRow: (best, downloading) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
    background: best ? 'rgba(255,0,0,0.05)' : 'rgba(255,255,255,0.03)',
    border: best ? '1px solid rgba(255,0,0,0.22)' : '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10, cursor: downloading ? 'default' : 'pointer', transition: 'all 0.15s',
    opacity: downloading ? 0.7 : 1 }),
  qBadge: (hd) => ({
    fontSize: 11, fontWeight: 500, minWidth: 46, textAlign: 'center', padding: '3px 7px', borderRadius: 6,
    background: hd ? 'rgba(255,0,0,0.18)' : 'rgba(255,255,255,0.08)',
    color: hd ? '#FF7777' : '#fff' }),
  fmtLabel: { flex: 1, fontSize: 13, color: 'var(--muted)' },
  fmtSize: { fontSize: 12, color: 'rgba(255,255,255,0.28)', fontWeight: 300 },
  bestTag: { fontSize: 10, background: 'rgba(255,0,0,0.2)', color: '#FF7777', borderRadius: 5, padding: '2px 7px', fontWeight: 500 },
  dlBtn: (active) => ({
    background: 'transparent', border: `1px solid ${active ? 'var(--red)' : 'rgba(255,255,255,0.1)'}`,
    color: active ? 'var(--red)' : 'var(--muted)', borderRadius: 8, width: 32, height: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
    transition: 'all 0.15s' }),

  // Progress
  progWrap: { background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px', marginTop: 10 },
  progTop: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 8 },
  progBg: { background: 'rgba(255,255,255,0.07)', borderRadius: 100, height: 4, overflow: 'hidden' },
  progFill: (pct) => ({ height: '100%', background: 'var(--red)', borderRadius: 100, width: pct + '%', transition: 'width 0.25s ease' }),

  // Error
  errBox: { background: 'rgba(255,0,0,0.06)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: 14, padding: '2rem',
    textAlign: 'center', animation: 'fadeIn 0.3s ease' },
  errMsg: { fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 4 },
  errHint: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  retryBtn: { marginTop: 14, background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.25)', color: '#FF7777',
    fontSize: 13, padding: '8px 20px', borderRadius: 8 },

  // Idle steps
  stepsWrap: { display: 'flex', flexDirection: 'column', gap: 14 },
  stepRow: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  stepNum: { width: 32, height: 32, background: 'var(--red-dim)', border: '1px solid var(--red-border)',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumTxt: { fontSize: 13, fontWeight: 500, color: '#FF7777' },
  stepTitle: { fontSize: 13, fontWeight: 500, marginBottom: 2 },
  stepSub: { fontSize: 12, color: 'var(--muted)' },

  // Footer strip
  strip: { display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap',
    padding: '1rem 2rem', borderTop: '1px solid rgba(255,255,255,0.04)', width: '100%', maxWidth: 680 },
  stripItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  notice: { fontSize: 11, color: 'rgba(255,255,255,0.18)', padding: '0.5rem 2rem 1.5rem', textAlign: 'center', lineHeight: 1.6, maxWidth: 600 },
}

export default function App() {
  const [url, setUrl] = useState('')
  const [state, setState] = useState('idle') // idle | loading | result | error
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('video')
  const [downloading, setDownloading] = useState(null) // fmtId being downloaded
  const [dlProgress, setDlProgress] = useState(0)
  const [dlMsg, setDlMsg] = useState('')
  const inputRef = useRef()

  const isYtUrl = (u) => /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/.test(u)

  const fetchInfo = async () => {
    const trimmed = url.trim()
    if (!trimmed) { inputRef.current?.focus(); return }
    if (!isYtUrl(trimmed)) {
      setState('error')
      setError('That doesn\'t look like a valid YouTube URL.')
      return
    }
    setState('loading')
    try {
      const res = await fetch(`${API}/info?url=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch info')
      setInfo(data)
      setState('result')
      setTab('video')
    } catch (e) {
      setState('error')
      setError(e.message)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
    } catch { inputRef.current?.focus() }
  }

  const startDownload = async (fmtSelector, type, quality) => {
    const key = `${type}_${fmtSelector}_${quality}`
    setDownloading(key)
    setDlProgress(0)
    setDlMsg(`Preparing ${type === 'audio' ? 'audio' : 'video'}…`)

    // Simulate progress while real download happens
    let prog = 0
    const iv = setInterval(() => {
      prog = Math.min(prog + Math.random() * 8 + 2, 90)
      setDlProgress(Math.round(prog))
      if (prog > 40) setDlMsg('Merging audio & video with ffmpeg…')
      if (prog > 70) setDlMsg('Almost done…')
    }, 400)

    try {
      const params = new URLSearchParams({
        url: url.trim(),
        fmtSelector: fmtSelector || '',
        type,
        quality: quality || '',
        title: info?.title || 'video',
      })
      const res = await fetch(`${API}/download?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Download failed' }))
        throw new Error(err.error || 'Download failed')
      }

      // Stream the file to browser
      const blob = await res.blob()
      clearInterval(iv)
      setDlProgress(100)
      setDlMsg('✓ Complete!')

      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = type === 'audio'
        ? `${info.title.slice(0, 60)}.mp3`
        : `${info.title.slice(0, 60)}_${quality}.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(dlUrl)

      setTimeout(() => { setDownloading(null); setDlProgress(0) }, 2000)
    } catch (e) {
      clearInterval(iv)
      setDownloading(null)
      setDlProgress(0)
      alert('Download error: ' + e.message)
    }
  }

  const reset = () => { setState('idle'); setUrl(''); setInfo(null); setError('') }

  const videoFmts = info?.videoFormats || []
  const audioFmts = info?.audioFormats || [
    { fmtSelector: 'bestaudio', quality: '320k', label: 'MP3 — Best Quality' },
    { fmtSelector: 'bestaudio', quality: '192k', label: 'MP3 — Standard' },
    { fmtSelector: 'bestaudio', quality: '128k', label: 'MP3 — Small' },
  ]

  return (
    <div style={s.page}>
      {/* Hero */}
      <div style={s.hero}>
        <div style={s.logoRow}>
          <div style={s.ytIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.2v1.9C.7 15.2 1 17.3 1 17.3s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.6 21.5 12 21.5 12 21.5s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8S23.3 15.2 23.3 13.1v-1.9C23.3 9.1 23 7 23 7zM9.7 15.5V8.3l8.1 3.6-8.1 3.6z"/>
            </svg>
          </div>
          <div style={s.brand}>TUBE<span style={s.brandRed}>GRAB</span></div>
        </div>
        <p style={s.tagline}>Download YouTube videos with audio — fast, free, no sign-up</p>

        <div style={{ ...s.bar, borderColor: url ? 'rgba(255,0,0,0.35)' : 'rgba(255,255,255,0.1)' }}>
          <i className="ti ti-link" style={{ fontSize: 17, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchInfo()}
            placeholder="Paste a YouTube URL here…"
            style={s.barInput}
            autoComplete="off"
          />
          <button style={s.pasteBtn} onClick={handlePaste}>
            <i className="ti ti-clipboard" style={{ fontSize: 12, marginRight: 4, verticalAlign: -1 }} />
            Paste
          </button>
          <button style={s.analyzeBtn(state === 'loading')} onClick={fetchInfo} disabled={state === 'loading'}>
            {state === 'loading'
              ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />Fetching…</>
              : <><i className="ti ti-search" style={{ fontSize: 14 }} />Analyze</>
            }
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>

        {/* IDLE */}
        {state === 'idle' && (
          <div style={s.stepsWrap}>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.22)', fontWeight: 500, marginBottom: 4 }}>How it works</p>
            {[
              ['Paste the link', 'Copy any YouTube video URL and paste it in the bar above'],
              ['Pick your format', 'Choose video (MP4 with merged audio) or audio-only (MP3)'],
              ['Download instantly', 'ffmpeg merges the streams — your file saves directly'],
            ].map(([title, sub], i) => (
              <div key={i} style={s.stepRow}>
                <div style={s.stepNum}><span style={s.stepNumTxt}>{i + 1}</span></div>
                <div><p style={s.stepTitle}>{title}</p><p style={s.stepSub}>{sub}</p></div>
              </div>
            ))}
          </div>
        )}

        {/* LOADING */}
        {state === 'loading' && (
          <div style={s.loadingBox}>
            <div style={s.spinner} />
            <p style={s.loadingMsg}>Fetching video info…</p>
          </div>
        )}

        {/* RESULT */}
        {state === 'result' && info && (
          <div style={s.resultCard}>
            {/* Video meta */}
            <div style={s.videoMeta}>
              <div style={s.thumbWrap}>
                {info.thumbnail && <img src={info.thumbnail} alt="thumbnail" style={s.thumb} />}
                <div style={s.thumbOverlay}>
                  <i className="ti ti-player-play-filled" style={{ fontSize: 26, color: '#fff', filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.8))' }} />
                </div>
              </div>
              <div style={s.videoInfoCol}>
                <p style={s.videoTitle}>{info.title}</p>
                <div style={s.metaRow}>
                  <span style={s.metaChip}><i className="ti ti-user" style={{ fontSize: 13 }} />{info.channel}</span>
                  {info.durationString && <span style={s.metaChip}><i className="ti ti-clock" style={{ fontSize: 13 }} />{info.durationString}</span>}
                  {info.viewCount && <span style={s.metaChip}><i className="ti ti-eye" style={{ fontSize: 13 }} />{formatViews(info.viewCount)}</span>}
                </div>
              </div>
            </div>
            <div style={s.divider} />

            {/* Format picker */}
            <div style={s.fmtSec}>
              <p style={s.fmtHeader}>Choose format</p>
              <div style={s.tabRow}>
                <button style={s.tab(tab === 'video')} onClick={() => setTab('video')}>
                  <i className="ti ti-video" style={{ fontSize: 12, marginRight: 4, verticalAlign: -1 }} />Video (MP4)
                </button>
                <button style={s.tab(tab === 'audio')} onClick={() => setTab('audio')}>
                  <i className="ti ti-music" style={{ fontSize: 12, marginRight: 4, verticalAlign: -1 }} />Audio only (MP3)
                </button>
              </div>

              <div style={s.fmtList}>
                {tab === 'video' && videoFmts.map((fmt, i) => {
                  const key = `video_${fmt.fmtSelector}_${fmt.quality}`
                  const isDl = downloading === key
                  const isHD = fmt.height >= 1080
                  return (
                    <div key={fmt.fmtSelector + fmt.quality} style={s.fmtRow(i === 0, !!downloading)}
                      onClick={() => !downloading && startDownload(fmt.fmtSelector, 'video', fmt.quality)}>
                      <span style={s.qBadge(isHD)}>{fmt.quality}</span>
                      <span style={s.fmtLabel}>MP4 · video+audio{fmt.fps ? ` · ${fmt.fps}fps` : ''}</span>
                      {i === 0 && <span style={s.bestTag}>BEST</span>}
                      <span style={s.fmtSize}>{formatBytes(fmt.filesize) || ''}</span>
                      <button style={s.dlBtn(isDl)} onClick={e => { e.stopPropagation(); !downloading && startDownload(fmt.fmtSelector, 'video', fmt.quality) }}>
                        {isDl
                          ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,0,0,0.3)', borderTopColor: 'var(--red)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          : <i className="ti ti-download" />
                        }
                      </button>
                    </div>
                  )
                })}

                {tab === 'video' && videoFmts.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>No video formats found for this URL.</p>
                )}

                {tab === 'audio' && audioFmts.map((fmt, i) => {
                  const key = `audio_${fmt.fmtSelector}_${fmt.quality}`
                  const isDl = downloading === key
                  return (
                    <div key={key} style={s.fmtRow(i === 0, !!downloading)}
                      onClick={() => !downloading && startDownload(fmt.fmtSelector, 'audio', fmt.quality)}>
                      <span style={s.qBadge(i === 0)}>{fmt.quality}</span>
                      <span style={s.fmtLabel}>{fmt.label}</span>
                      {i === 0 && <span style={s.bestTag}>BEST</span>}
                      <span style={s.fmtSize}></span>
                      <button style={s.dlBtn(isDl)} onClick={e => { e.stopPropagation(); !downloading && startDownload(fmt.fmtSelector, 'audio', fmt.quality) }}>
                        {isDl
                          ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,0,0,0.3)', borderTopColor: 'var(--red)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          : <i className="ti ti-download" />
                        }
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Progress bar */}
              {downloading && (
                <div style={s.progWrap}>
                  <div style={s.progTop}>
                    <span>{dlMsg}</span>
                    <span>{dlProgress}%</span>
                  </div>
                  <div style={s.progBg}>
                    <div style={s.progFill(dlProgress)} />
                  </div>
                </div>
              )}
            </div>

            {/* New download button */}
            <div style={{ padding: '0 1.2rem 1.2rem' }}>
              <button onClick={reset}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--muted)', fontSize: 13, padding: '10px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <i className="ti ti-refresh" style={{ fontSize: 14 }} />Download another video
              </button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {state === 'error' && (
          <div style={s.errBox}>
            <i className="ti ti-alert-circle" style={{ fontSize: 34, color: '#FF6666', display: 'block', marginBottom: 10 }} />
            <p style={s.errMsg}>{error}</p>
            <p style={s.errHint}>Make sure the URL is a valid public YouTube video link.</p>
            <button style={s.retryBtn} onClick={reset}>Try again</button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={s.strip}>
        {[['ti-bolt','Fast ffmpeg merging'],['ti-shield-check','No sign-up needed'],['ti-device-mobile','Works on all devices'],['ti-music','MP3 & MP4 with audio']].map(([ic, lbl]) => (
          <div key={lbl} style={s.stripItem}><i className={`ti ${ic}`} style={{ fontSize: 14 }} />{lbl}</div>
        ))}
      </div>
      <p style={s.notice}>For personal use only. Respect copyright laws and YouTube's Terms of Service.<br />Only download content you have the right to download.</p>
    </div>
  )
}
