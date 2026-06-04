import { useState, useEffect, useRef } from 'react'
import useMapStore from '../store/mapStore'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"

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
  const [comments, setComments]       = useState([])
  const [newComment, setNewComment]   = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPlaying, setIsPlaying]     = useState(false)
  const [likes, setLikes]             = useState(pixel.likes ?? 0)
  const [hasLiked, setHasLiked]       = useState(false)
  const [isLiking, setIsLiking]       = useState(false)
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
    if (hasLiked || isLiking) return
    setIsLiking(true)
    try {
      await useMapStore.getState().likePixel(pixel.id)
      setLikes(l => l + 1)
      setHasLiked(true)
      localStorage.setItem(likeKey, '1')
    } catch (e) { console.error(e) }
    finally { setIsLiking(false) }
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

  const accent     = pixelColor
  const sidebarBg  = isLight ? '#ffffff' : 'var(--bg-secondary)'
  const mutedColor = isLight ? 'rgba(26,48,128,0.6)' : 'var(--text-muted)'
  const dividerClr = isLight ? 'rgba(26,48,128,0.12)' : `${pixelColor}22`
  const btnBg      = isLight ? '#f4f6fb' : 'rgba(255,255,255,0.04)'
  const btnBorder  = isLight ? 'rgba(26,48,128,0.15)' : 'rgba(255,255,255,0.1)'
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
        color: mutedColor, fontSize: 20,
        cursor: 'pointer', lineHeight: 1, padding: 6, fontFamily: MONO,
      }}>✕</button>

      {/* Country header */}
      <div style={{ padding: '36px 28px 20px', paddingLeft: 52 }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10 }}>{country.flag}</div>
        <div style={{ fontFamily: BEBAS, fontSize: 32, color: accent, letterSpacing: 2 }}>
          {country.name}
        </div>
        <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 10, marginTop: 4, letterSpacing: 1 }}>
          ESPACE VOCAL
        </div>
      </div>

      <div style={{ height: 1, background: dividerClr, margin: '0 28px' }} />

      {/* Buyer info */}
      <div style={{ padding: '18px 28px 0' }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: mutedColor, letterSpacing: 2, marginBottom: 6 }}>
          VOIX DE
        </div>
        <div style={{ fontFamily: BEBAS, fontSize: 22, color: accent, letterSpacing: 1, marginBottom: 10 }}>
          {pixel.pseudo || 'Anonyme'}
        </div>

        {pixel.description && (
          <div style={{
            fontFamily: MONO, fontSize: 11, color: isLight ? '#222' : 'var(--text)',
            lineHeight: 1.7, marginBottom: 18,
            padding: '10px 12px',
            background: `${accent}0D`,
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

        {/* Likes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button
            onClick={handleLike}
            disabled={hasLiked || isLiking}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: hasLiked ? 'rgba(239,68,68,0.1)' : btnBg,
              border: `1px solid ${hasLiked ? 'rgba(239,68,68,0.45)' : btnBorder}`,
              color: hasLiked ? '#EF4444' : mutedColor,
              fontFamily: MONO, fontSize: 12, letterSpacing: 1,
              padding: '7px 14px', cursor: hasLiked ? 'default' : 'pointer',
              borderRadius: 2, transition: 'all 0.2s', boxShadow: shadow,
            }}
          >
            <span style={{ fontSize: 14 }}>{hasLiked ? '❤️' : '🤍'}</span>
            <span>{likes}</span>
          </button>
          {hasLiked && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: mutedColor, letterSpacing: 1 }}>
              VOUS AVEZ AIMÉ
            </span>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: dividerClr, margin: '0 28px' }} />

      {/* Comments */}
      <div style={{ padding: '18px 28px 32px', flex: 1 }}>
        <div style={{ fontFamily: BEBAS, fontSize: 18, color: accent, letterSpacing: 2, marginBottom: 14 }}>
          COMMENTAIRES ({comments.length})
        </div>

        {comments.length === 0 && (
          <div style={{ fontFamily: MONO, fontSize: 10, color: mutedColor, marginBottom: 14, opacity: 0.8 }}>
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
                fontFamily: MONO, fontSize: 11, color: isLight ? '#222' : 'var(--text)',
                lineHeight: 1.6, wordBreak: 'break-word',
              }}>
                {c.content}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: mutedColor, marginTop: 4 }}>
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
          style={{
            width: '100%', boxSizing: 'border-box',
            background: isLight ? 'rgba(26,48,128,0.04)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${btnBorder}`,
            color: isLight ? '#111' : 'var(--text)',
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
            border: `1px solid ${newComment.trim() ? `${accent}55` : btnBorder}`,
            color: newComment.trim() ? accent : mutedColor,
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
