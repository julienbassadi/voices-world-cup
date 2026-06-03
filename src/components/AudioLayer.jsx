import { useEffect, useRef } from 'react'
import useMapStore from '../store/mapStore'
import { QUALIFIED } from './WorldMap'

// ── Placeholder audio generation ──────────────────────────────────────────
// Generates a short PCM WAV tone derived from the pixel id.
// Replace pixel.audioUrl (Supabase Storage URL) to use real recordings.
const placeholderCache = new Map()

function makePlaceholderUrl(pixelId) {
  if (placeholderCache.has(pixelId)) return placeholderCache.get(pixelId)

  // Deterministic frequency from pixel id
  let h = 0
  for (const c of pixelId) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const freq  = 200 + (h % 320)   // 200–520 Hz (voice range)
  const freq2 = freq * 1.5         // a fifth above, for richer tone

  const sr  = 22050
  const dur = 2.0
  const n   = Math.floor(sr * dur)
  const buf = new ArrayBuffer(44 + n * 2)
  const v   = new DataView(buf)
  const ws  = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }

  ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE')
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, 1, true); v.setUint32(24, sr, true)
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  ws(36, 'data'); v.setUint32(40, n * 2, true)

  for (let i = 0; i < n; i++) {
    const t   = i / sr
    const env = Math.min(1, t * 6, (dur - t) * 6)
    const s   = (Math.sin(2 * Math.PI * freq * t) * 0.65 +
                 Math.sin(2 * Math.PI * freq2 * t) * 0.35) * env * 0.22 * 32767
    v.setInt16(44 + i * 2, s | 0, true)
  }

  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  placeholderCache.set(pixelId, url)
  return url
}

function getAudioUrl(pixel) {
  // pixel.audioUrl will be set by Supabase Storage in production
  return pixel.audioUrl ?? makePlaceholderUrl(pixel.id)
}

// ── Constants ────────────────────────────────────────────────────────────
const MAX_AMBIENT = 8   // max concurrent ambient loop players

export default function AudioLayer() {
  // ambient loop players — Map<"iso:id", HTMLAudioElement>
  const ambientRef   = useRef(new Map())
  // foreground click player — independent of mute, plays once
  const clickAudioRef = useRef(null)

  const muted            = useMapStore(s => s.muted)
  const zoomLevel        = useMapStore(s => s.zoomLevel)
  const pixelsByCountry  = useMapStore(s => s.pixelsByCountry)
  const clickedPixel     = useMapStore(s => s.clickedPixel)
  const setPlayingPixels = useMapStore(s => s.setPlayingPixels)

  // Stable getter — used inside effects that shouldn't re-fire on pixel purchases
  const getPixelsByCountry = () => useMapStore.getState().pixelsByCountry

  // ── Create/destroy ambient HTMLAudioElements when pixels are purchased ───
  useEffect(() => {
    const currentKeys = new Set()

    QUALIFIED.forEach(({ iso }) => {
      ;(pixelsByCountry[iso] ?? []).forEach(pixel => {
        const key = `${iso}:${pixel.id}`
        currentKeys.add(key)
        if (!ambientRef.current.has(key)) {
          const audio = new Audio(getAudioUrl(pixel))
          audio.loop    = true
          audio.volume  = 0
          audio.preload = 'none'
          ambientRef.current.set(key, audio)
        }
      })
    })

    // Prune removed pixels
    for (const [key, audio] of ambientRef.current) {
      if (!currentKeys.has(key)) {
        audio.pause()
        audio.src = ''
        ambientRef.current.delete(key)
      }
    }
  }, [pixelsByCountry])

  // ── Ambient playback — volume ∝ zoom, capped at MAX_AMBIENT players ──────
  // At zoom=1 nothing plays (vol=0). Voices emerge as you zoom in.
  useEffect(() => {
    // vol: 0 at zoom≤1, linear up to 0.55 at zoom=8
    const vol = muted ? 0 : Math.min(0.55, Math.max(0, (zoomLevel - 1) / 7) * 0.55)
    const THRESHOLD = 0.005

    let i = 0
    for (const audio of ambientRef.current.values()) {
      const active = !muted && vol > THRESHOLD && i < MAX_AMBIENT
      audio.volume = active ? vol : 0
      if (active && audio.paused)  audio.play().catch(() => {})
      if (!active && !audio.paused) audio.pause()
      i++
    }
  }, [muted, zoomLevel, pixelsByCountry])

  // ── Click-to-play ─────────────────────────────────────────────────────────
  // Works regardless of mute. Illuminates all pixels sharing the same userId.
  // Uses getState() so pixel data is fresh without adding pixelsByCountry to deps.
  useEffect(() => {
    if (!clickedPixel) return
    const { iso, pixelId } = clickedPixel
    const pbc = getPixelsByCountry()

    const clicked = (pbc[iso] ?? []).find(p => p.id === pixelId)
    if (!clicked) return

    // All pixels sharing the same userId (null means only the clicked one)
    const sameUser = clicked.userId
      ? Object.entries(pbc).flatMap(([cIso, arr]) =>
          (arr ?? [])
            .filter(p => p.userId === clicked.userId)
            .map(p => ({ iso: cIso, pixel: p }))
        )
      : [{ iso, pixel: clicked }]

    // Stop any previous click-play
    if (clickAudioRef.current) {
      clickAudioRef.current.pause()
      clickAudioRef.current.onended = null
      clickAudioRef.current = null
    }

    // Light up all matching pixels
    setPlayingPixels(new Set(sameUser.map(({ iso: i, pixel: p }) => `${i}:${p.id}`)))

    // Play once at full volume (not affected by mute)
    const audio = new Audio(getAudioUrl(clicked))
    audio.volume  = 1
    audio.preload = 'auto'
    clickAudioRef.current = audio

    audio.play().catch(() => {})

    audio.onended = () => {
      clickAudioRef.current = null
      setPlayingPixels(new Set())
      // Resume ambient loop for this pixel if unmuted
      const st = useMapStore.getState()
      const ambientAudio = ambientRef.current.get(`${iso}:${pixelId}`)
      if (ambientAudio && !st.muted) {
        const vol = Math.min(0.55, Math.max(0, (st.zoomLevel - 1) / 7) * 0.55)
        if (vol > 0.005) {
          ambientAudio.volume = vol
          ambientAudio.play().catch(() => {})
        }
      }
    }
  }, [clickedPixel])  // clickedPixel.ts ensures re-clicks on the same pixel re-trigger

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    for (const audio of ambientRef.current.values()) { audio.pause(); audio.src = '' }
    if (clickAudioRef.current) { clickAudioRef.current.pause(); clickAudioRef.current.onended = null }
    setPlayingPixels(new Set())
    for (const url of placeholderCache.values()) URL.revokeObjectURL(url)
    placeholderCache.clear()
  }, [])

  return null
}
