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
        style={{ color: '#E8C84A', wordBreak: 'break-all', textDecoration: 'underline' }}>
        {url}
      </a>
    )
    lastIndex = urlRegex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

export default function PixelModal({ country, pixel, onClose }) {
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
    setHasLiked(!!localStorage.getItem(likeKey))
    loadComments()
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    }
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
    } catch (e) {
      console.error('like error:', e)
    } finally {
      setIsLiking(false)
    }
  }

  function handlePlayAudio() {
    if (!pixel.audioUrl) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setIsPlaying(false)
      return
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
    } catch (e) {
      console.error('addComment error:', e)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: `2px solid ${pixelColor}`,
          width: 440, maxWidth: '92vw', maxHeight: '88vh',
          borderRadius: 3, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.18s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '22px 24px 16px',
          borderBottom: `1px solid ${pixelColor}22`,
          flexShrink: 0,
          position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 16,
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: 18,
            cursor: 'pointer', padding: 4, lineHeight: 1, fontFamily: MONO,
          }}>✕</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 38, lineHeight: 1 }}>{country.flag}</span>
            <div>
              <div style={{
                fontFamily: BEBAS, fontSize: 26, color: pixelColor,
                letterSpacing: 2, lineHeight: 1,
              }}>
                {country.name}
              </div>
              <div style={{
                fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)',
                letterSpacing: 1, marginTop: 3,
              }}>
                ESPACE VOCAL
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px 28px' }}>

          {/* Buyer info */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)',
              letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
            }}>
              Voix de
            </div>
            <div style={{
              fontFamily: BEBAS, fontSize: 22, color: 'var(--text)',
              letterSpacing: 1,
            }}>
              {pixel.pseudo || 'Anonyme'}
            </div>
            {pixel.description && (
              <div style={{
                fontFamily: MONO, fontSize: 12, color: 'var(--text)',
                lineHeight: 1.7, marginTop: 8,
                padding: '10px 12px',
                background: `${pixelColor}0D`,
                borderLeft: `2px solid ${pixelColor}55`,
                borderRadius: '0 2px 2px 0',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {renderDescription(pixel.description)}
              </div>
            )}
          </div>

          {/* Audio player */}
          {pixel.audioUrl && (
            <button onClick={handlePlayAudio} style={{
              width: '100%', padding: '13px 0', marginBottom: 18,
              background: isPlaying ? 'rgba(34,197,94,0.08)' : `${pixelColor}11`,
              border: `1px solid ${isPlaying ? 'rgba(34,197,94,0.45)' : `${pixelColor}44`}`,
              color: isPlaying ? '#22C55E' : pixelColor,
              fontFamily: MONO, fontSize: 12, letterSpacing: 2,
              cursor: 'pointer', borderRadius: 2, transition: 'all 0.2s',
            }}>
              {isPlaying ? '⏸ EN COURS…' : '▶ ÉCOUTER LA VOIX'}
            </button>
          )}

          {/* Likes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <button
              onClick={handleLike}
              disabled={hasLiked || isLiking}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: hasLiked ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${hasLiked ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.12)'}`,
                color: hasLiked ? '#EF4444' : 'var(--text-muted)',
                fontFamily: MONO, fontSize: 13, letterSpacing: 1,
                padding: '7px 16px', cursor: hasLiked ? 'default' : 'pointer',
                borderRadius: 2, transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 15 }}>{hasLiked ? '❤️' : '🤍'}</span>
              <span>{likes}</span>
            </button>
            {hasLiked && (
              <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1 }}>
                VOUS AVEZ AIMÉ
              </span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: `${pixelColor}1A`, marginBottom: 20 }} />

          {/* Comments */}
          <div>
            <div style={{
              fontFamily: BEBAS, fontSize: 18, color: pixelColor,
              letterSpacing: 2, marginBottom: 14,
            }}>
              COMMENTAIRES ({comments.length})
            </div>

            {comments.length === 0 && (
              <div style={{
                fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)',
                letterSpacing: 0.5, marginBottom: 16, opacity: 0.7,
              }}>
                Aucun commentaire. Soyez le premier !
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {comments.map(c => (
                <div key={c.id} style={{
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: `2px solid ${pixelColor}33`,
                  borderRadius: '0 2px 2px 0',
                }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 12, color: 'var(--text)',
                    lineHeight: 1.6, wordBreak: 'break-word',
                  }}>
                    {c.content}
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)',
                    marginTop: 5, letterSpacing: 0.5,
                  }}>
                    {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>

            {/* New comment */}
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Laisser un commentaire…"
              rows={3}
              maxLength={500}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text)',
                fontFamily: MONO, fontSize: 12, padding: '10px 12px',
                borderRadius: 2, resize: 'none', outline: 'none',
                marginBottom: 8, lineHeight: 1.6,
              }}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || isSubmitting}
              style={{
                width: '100%', padding: '11px 0',
                background: newComment.trim() ? `${pixelColor}14` : 'transparent',
                border: `1px solid ${newComment.trim() ? `${pixelColor}55` : 'rgba(255,255,255,0.1)'}`,
                color: newComment.trim() ? pixelColor : 'var(--text-muted)',
                fontFamily: MONO, fontSize: 11, letterSpacing: 2,
                cursor: newComment.trim() && !isSubmitting ? 'pointer' : 'default',
                borderRadius: 2, transition: 'all 0.2s',
              }}
            >
              {isSubmitting ? 'ENVOI…' : 'PUBLIER'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
