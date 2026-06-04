import { useState, useEffect, useRef } from 'react'
import useMapStore from '../store/mapStore'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"

const LIGHT_TEXT   = '#1a2040'
const DARK_TEXT    = '#F0F0F0'
const DARK_MUTED   = 'rgba(255,255,255,0.5)'
const LIGHT_MUTED  = 'rgba(26,48,128,0.6)'

function renderDescription(text) {
  if (!text) return null
  const parts = []
  let lastIndex = 0
  const urlRegex = /https?:\/\/\S+/g
  let match
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const url = match[0]
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
        style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}>
        {url}
      </a>
    )
    lastIndex = urlRegex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

export default function VocalSpace({ country, pixel, onClose }) {
  const [isLight, setIsLight] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'light'
  )
  const [comments, setComments]         = useState([])
  const [newComment, setNewComment]     = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPlaying, setIsPlaying]       = useState(false)
  const [likes, setLikes]               = useState(pixel.likes ?? 0)
  const [hasLiked, setHasLiked]         = useState(false)
  const [isLiking, setIsLiking]         = useState(false)
  const audioRef = useRef(null)

  const likeKey    = `liked_pixel_${pixel.id}`
  const pixelColor = pixel.color ?? '#E8C84A'

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    setHasLiked(!!localStorage.getItem(likeKey))
    setLikes(pixel.likes ?? 0)
    loadComments()
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }
  }, [pixel.id])

  async function loadComments() {
    const data = await useMapStore.getState().loadComments(pixel.id)
    setComments(data)
  }

  async function handleLike() {
    if (isLiking) return

    // Read truth from localStorage directly — avoids stale-closure issues with hasLiked state
    const wasLiked = !!localStorage.getItem(likeKey)
    console.log(`[like] clic — localStorage avant: ${wasLiked ? 'liked' : 'not liked'} | state hasLiked: ${hasLiked}`)

    setIsLiking(true)

    if (wasLiked) {
      console.log('[like] → unlike : retire du localStorage, décrémente UI')
      localStorage.removeItem(likeKey)
      setHasLiked(false)
      setLikes(l => Math.max(0, l - 1))
    } else {
      console.log('[like] → like : ajoute au localStorage, incrémente UI')
      localStorage.setItem(likeKey, '1')
      setHasLiked(true)
      setLikes(l => l + 1)
    }
    console.log(`[like] localStorage après : ${localStorage.getItem(likeKey) ?? 'absent'}`)

    try {
      if (wasLiked) {
        await useMapStore.getState().unlikePixel(pixel.id)
        console.log('[like] unlike synced Supabase ✓')
      } else {
        await useMapStore.getState().likePixel(pixel.id)
        console.log('[like] like synced Supabase ✓')
      }
    } catch (e) {
      // localStorage + UI state are kept — don't revert, Supabase sync best-effort
      console.warn('[like] Supabase sync failed (état UI conservé) :', e.message)
    } finally {
      setIsLiking(false)
    }
  }

  function handlePlayAudio() {
    if (!pixel.audioUrl) return
    if (audioRef.current) {
      audioRef.current.pause(); audioRef.current = null; setIsPlaying(false); return
    }
    const audio = new Audio(pixel.audioUrl)
    audioRef.current = audio
    audio.onended = () => { audioRef.current = null; setIsPlaying(false) }
    audio.play().catch(() => {})
    setIsPlaying(true)
  }

  async function handleAddComment() {
    const text = newComment.trim()
    if (!text || isSubmitting) return
    setIsSubmitting(true)
    try {
      await useMapStore.getState().addComment(pixel.id, text)
      setNewComment('')
      await loadComments()
    } catch (e) { console.error(e) }
    finally { setIsSubmitting(false) }
  }

  const text       = isLight ? LIGHT_TEXT  : DARK_TEXT
  const muted      = isLight ? LIGHT_MUTED : DARK_MUTED
  const accent     = pixelColor
  const sidebarBg  = isLight ? '#ffffff' : 'var(--bg-secondary)'
  const dividerClr = isLight ? 'rgba(26,48,128,0.12)' : `${pixelColor}28`
  const inputBg    = isLight ? 'rgba(26,48,128,0.06)' : 'rgba(255,255,255,0.06)'
  const inputBdr   = isLight ? 'rgba(26,48,128,0.18)' : 'rgba(255,255,255,0.12)'
  const shadow     = isLight ? '0 2px 12px rgba(0,0,0,0.15)' : 'none'

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 320,
      background: sidebarBg,
      borderLeft: `2px solid ${accent}`,
      boxShadow: shadow,
      zIndex: 300,
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
      overflowY: 'auto',
    }}>

      {/* Close */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, left: 18,
        background: 'none', border: 'none',
        color: muted, fontSize: 20,
        cursor: 'pointer', lineHeight: 1, padding: 6, fontFamily: MONO,
      }}>✕</button>

      {/* Country header */}
      <div style={{ padding: '36px 28px 20px', paddingLeft: 52 }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10 }}>{country.flag}</div>
        <div style={{ fontFamily: BEBAS, fontSize: 32, color: accent, letterSpacing: 2 }}>
          {country.name}
        </div>
        <div style={{ fontFamily: MONO, color: muted, fontSize: 10, marginTop: 4, letterSpacing: 1 }}>
          ESPACE VOCAL
        </div>
      </div>

      <div style={{ height: 1, background: dividerClr, margin: '0 28px' }} />

      {/* Buyer info */}
      <div style={{ padding: '18px 28px 0' }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: muted, letterSpacing: 2, marginBottom: 6 }}>
          VOIX DE
        </div>
        <div style={{ fontFamily: BEBAS, fontSize: 22, color: accent, letterSpacing: 1, marginBottom: 10 }}>
          {pixel.pseudo || 'Anonyme'}
        </div>

        {pixel.description && (
          <div style={{
            fontFamily: MONO, fontSize: 11, color: text,
            lineHeight: 1.7, marginBottom: 18,
            padding: '10px 12px',
            background: `${accent}12`,
            borderLeft: `2px solid ${accent}55`,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {renderDescription(pixel.description)}
          </div>
        )}

        {/* Audio */}
        {pixel.audioUrl && (
          <button onClick={handlePlayAudio} style={{
            width: '100%', padding: '13px 0', marginBottom: 14,
            background: isPlaying ? 'rgba(34,197,94,0.08)' : `${accent}11`,
            border: `1px solid ${isPlaying ? 'rgba(34,197,94,0.45)' : `${accent}44`}`,
            color: isPlaying ? '#22C55E' : accent,
            fontFamily: MONO, fontSize: 11, letterSpacing: 2,
            cursor: 'pointer', borderRadius: 2, transition: 'all 0.2s',
          }}>
            {isPlaying ? '⏸ EN COURS…' : '▶ ÉCOUTER LA VOIX'}
          </button>
        )}

        {/* Likes — toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={handleLike}
            disabled={isLiking}
            title={hasLiked ? 'Retirer mon like' : 'Aimer cette voix'}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: hasLiked ? 'rgba(239,68,68,0.12)' : inputBg,
              border: `1px solid ${hasLiked ? 'rgba(239,68,68,0.5)' : inputBdr}`,
              color: hasLiked ? '#FF6B6B' : text,
              fontFamily: BEBAS, fontSize: 16, letterSpacing: 1,
              padding: '8px 16px', cursor: isLiking ? 'wait' : 'pointer',
              borderRadius: 2, transition: 'all 0.2s', boxShadow: shadow,
              opacity: isLiking ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{hasLiked ? '❤️' : '🤍'}</span>
            <span style={{ minWidth: 20, textAlign: 'left' }}>{likes}</span>
          </button>
          <span style={{ fontFamily: MONO, fontSize: 9, color: muted, letterSpacing: 1 }}>
            {hasLiked ? 'VOUS AVEZ AIMÉ' : 'J\'AIME'}
          </span>
        </div>
      </div>

      <div style={{ height: 1, background: dividerClr, margin: '0 28px' }} />

      {/* Comments */}
      <div style={{ padding: '18px 28px 32px', flex: 1 }}>
        <div style={{ fontFamily: BEBAS, fontSize: 18, color: accent, letterSpacing: 2, marginBottom: 14 }}>
          COMMENTAIRES ({comments.length})
        </div>

        {comments.length === 0 && (
          <div style={{ fontFamily: MONO, fontSize: 10, color: muted, marginBottom: 14, opacity: 0.8 }}>
            Aucun commentaire. Soyez le premier !
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {comments.map(c => (
            <div key={c.id} style={{
              padding: '9px 11px',
              background: `${accent}0A`,
              borderLeft: `2px solid ${accent}33`,
            }}>
              <div style={{
                fontFamily: MONO, fontSize: 11, color: text,
                lineHeight: 1.6, wordBreak: 'break-word',
              }}>
                {c.content}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: muted, marginTop: 4 }}>
                {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </div>
            </div>
          ))}
        </div>

        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Laisser un commentaire…"
          rows={3}
          maxLength={500}
          className="vocal-space-input"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: inputBg,
            border: `1px solid ${inputBdr}`,
            color: text,
            fontFamily: MONO, fontSize: 11, padding: '9px 12px',
            borderRadius: 2, resize: 'none', outline: 'none',
            marginBottom: 8, lineHeight: 1.6,
          }}
        />
        <button
          onClick={handleAddComment}
          disabled={!newComment.trim() || isSubmitting}
          style={{
            width: '100%', padding: '11px 0',
            background: newComment.trim() ? `${accent}14` : 'transparent',
            border: `1px solid ${newComment.trim() ? `${accent}55` : inputBdr}`,
            color: newComment.trim() ? accent : muted,
            fontFamily: MONO, fontSize: 11, letterSpacing: 2,
            cursor: newComment.trim() && !isSubmitting ? 'pointer' : 'default',
            borderRadius: 2, transition: 'all 0.2s', boxShadow: shadow,
          }}
        >
          {isSubmitting ? 'ENVOI…' : 'PUBLIER'}
        </button>
      </div>
    </div>
  )
}
