import { useEffect, useRef } from 'react'
import useMapStore from '../store/mapStore'

// ── Placeholder audio generation ──────────────────────────────────────────
// Generates a short PCM WAV tone derived from the pixel id.
// Replace pixel.audioUrl (Supabase Storage URL) to use real recordings.
const placeholderCache = new Map()

function makePlaceholderUrl(pixelId) {
  if (placeholderCache.has(pixelId)) return placeholderCache.get(pixelId)

  let h = 0
  for (const c of pixelId) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const freq  = 200 + (h % 320)
  const freq2 = freq * 1.5

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
  return pixel.audioUrl ?? makePlaceholderUrl(pixel.id)
}

export default function AudioLayer() {
  const clickAudioRef = useRef(null)

  const clickedPixel     = useMapStore(s => s.clickedPixel)
  const setPlayingPixels = useMapStore(s => s.setPlayingPixels)

  // ── Click-to-play ─────────────────────────────────────────────────────────
  // Reads muted from getState() so the effect only fires on new clicks,
  // not every time the user toggles mute.
  useEffect(() => {
    if (!clickedPixel) return

    // Stop any previous playback
    if (clickAudioRef.current) {
      clickAudioRef.current.pause()
      clickAudioRef.current.onended = null
      clickAudioRef.current = null
    }
    setPlayingPixels(new Set())

    // Muted → nothing plays
    if (useMapStore.getState().muted) return

    const { iso, pixelId } = clickedPixel
    const pbc = useMapStore.getState().pixelsByCountry

    const clicked = (pbc[iso] ?? []).find(p => p.id === pixelId)
    if (!clicked) return

    // All pixels sharing the same userId (null → only the clicked one)
    const sameUser = clicked.userId
      ? Object.entries(pbc).flatMap(([cIso, arr]) =>
          (arr ?? [])
            .filter(p => p.userId === clicked.userId)
            .map(p => ({ iso: cIso, pixel: p }))
        )
      : [{ iso, pixel: clicked }]

    // Illuminate all matching pixels
    setPlayingPixels(new Set(sameUser.map(({ iso: i, pixel: p }) => `${i}:${p.id}`)))

    const audio = new Audio(getAudioUrl(clicked))
    audio.volume  = 1
    audio.preload = 'auto'
    clickAudioRef.current = audio

    audio.play().catch(() => {})
    audio.onended = () => {
      clickAudioRef.current = null
      setPlayingPixels(new Set())
    }
  }, [clickedPixel])

  // ── Stop playback when user mutes ─────────────────────────────────────────
  const muted = useMapStore(s => s.muted)
  useEffect(() => {
    if (!muted) return
    if (clickAudioRef.current) {
      clickAudioRef.current.pause()
      clickAudioRef.current.onended = null
      clickAudioRef.current = null
    }
    setPlayingPixels(new Set())
  }, [muted])

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (clickAudioRef.current) {
      clickAudioRef.current.pause()
      clickAudioRef.current.onended = null
    }
    setPlayingPixels(new Set())
    for (const url of placeholderCache.values()) URL.revokeObjectURL(url)
    placeholderCache.clear()
  }, [])

  return null
}
