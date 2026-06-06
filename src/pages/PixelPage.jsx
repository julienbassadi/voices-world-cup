import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import html2canvas from 'html2canvas'
import { supabase } from '../lib/supabase'
import { QUALIFIED } from '../components/WorldMap'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"
const SITE  = 'https://voicesworldcup.vercel.app'

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Seeded random bars so they're stable across renders
function makeBars(n = 44) {
  const bars = []
  for (let i = 0; i < n; i++) {
    const x = Math.sin(i * 127.1) * 43758.5453
    bars.push(0.15 + Math.abs(x - Math.floor(x)) * 0.85)
  }
  return bars
}

const BARS = makeBars()

export default function PixelPage({ pixelId }) {
  const [pixel, setPixel]           = useState(null)
  const [comments, setComments]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [playing, setPlaying]       = useState(false)
  const [liked, setLiked]           = useState(false)
  const [likeCount, setLikeCount]   = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [downloading, setDownloading]   = useState(false)
  const [shareMsg, setShareMsg]         = useState(null)

  const audioRef    = useRef(null)
  const cardRef     = useRef(null)
  const shareTimer  = useRef(null)

  useEffect(() => {
    Promise.all([
      supabase.from('pixels')
        .select('id, country_iso, color, pseudo, description, audio_url, likes, created_at')
        .eq('id', pixelId)
        .single(),
      supabase.from('comments')
        .select('id, content, created_at')
        .eq('pixel_id', pixelId)
        .order('created_at', { ascending: true }),
    ]).then(([pRes, cRes]) => {
      if (pRes.error || !pRes.data) { setNotFound(true); setLoading(false); return }
      setPixel(pRes.data)
      setLikeCount(pRes.data.likes ?? 0)
      setComments(cRes.data ?? [])
      setLoading(false)
    })
    return () => clearTimeout(shareTimer.current)
  }, [pixelId])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play().catch(() => {}); setPlaying(true) }
  }, [playing])

  const handleLike = useCallback(async () => {
    if (!pixel) return
    const next = !liked
    setLiked(next)
    setLikeCount(c => next ? c + 1 : c - 1)
    try {
      if (next) await supabase.rpc('increment_pixel_likes', { p_id: pixel.id })
      else      await supabase.rpc('decrement_pixel_likes', { p_id: pixel.id })
    } catch {
      setLiked(!next)
      setLikeCount(c => next ? c - 1 : c + 1)
    }
  }, [pixel, liked])

  const handleShare = useCallback(async () => {
    const url = `${SITE}/pixel/${pixelId}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Voices World Cup 2026', url }); return } catch {}
    }
    try { await navigator.clipboard.writeText(url) } catch {
      const ta = Object.assign(document.createElement('textarea'), {
        value: url, style: 'position:fixed;opacity:0',
      })
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setShareMsg('Lien copié !')
    clearTimeout(shareTimer.current)
    shareTimer.current = setTimeout(() => setShareMsg(null), 2200)
  }, [pixelId])

  const handleDownload = useCallback(async () => {
    if (!cardRef.current || downloading) return
    setDownloading(true)
    try {
      const el = cardRef.current
      // Scale so output width = 1080px (Instagram story width)
      const scale = 1080 / el.offsetWidth
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0f1117',
        logging: false,
        imageTimeout: 10000,
      })
      const a = document.createElement('a')
      a.download = `voix-${pixelId}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } catch (err) {
      console.error('download error:', err)
    } finally {
      setDownloading(false)
    }
  }, [pixelId, downloading])

  const country = useMemo(
    () => pixel ? QUALIFIED.find(c => c.iso === pixel.country_iso) : null,
    [pixel]
  )

  // ── Loading / 404 ──────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ background: '#0f1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: BEBAS, color: '#E8C84A', fontSize: 18, letterSpacing: 3 }}>
        CHARGEMENT…
      </div>
    </div>
  )

  if (notFound || !pixel) return (
    <div style={{ background: '#0f1117', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div style={{ fontFamily: BEBAS, color: '#E8C84A', fontSize: 22, letterSpacing: 3 }}>PIXEL INTROUVABLE</div>
      <a href={SITE} style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(232,200,74,0.5)', letterSpacing: 1, textDecoration: 'none' }}>← Retour à la carte</a>
    </div>
  )

  const accentColor = pixel.color ?? '#E8C84A'

  return (
    <div style={{
      background: '#0f1117',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px 48px',
    }}>
      {/* Hidden audio */}
      {pixel.audio_url && (
        <audio ref={audioRef} src={pixel.audio_url} onEnded={() => setPlaying(false)} preload="metadata" />
      )}

      {/* ── Story Card ──────────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        style={{
          width: '100%',
          maxWidth: 420,
          // 9:16 story ratio at 420px = 746.7px tall
          minHeight: 747,
          background: 'linear-gradient(170deg, #161c28 0%, #0f1117 50%, #0a0c13 100%)',
          border: '1.5px solid rgba(232,200,74,0.20)',
          boxShadow: '0 0 0 1px rgba(232,200,74,0.05), 0 24px 80px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Gold corner accents */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 28, height: 28,
          borderTop: '2px solid rgba(232,200,74,0.55)', borderLeft: '2px solid rgba(232,200,74,0.55)' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 28, height: 28,
          borderTop: '2px solid rgba(232,200,74,0.55)', borderRight: '2px solid rgba(232,200,74,0.55)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 28, height: 28,
          borderBottom: '2px solid rgba(232,200,74,0.55)', borderLeft: '2px solid rgba(232,200,74,0.55)' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28,
          borderBottom: '2px solid rgba(232,200,74,0.55)', borderRight: '2px solid rgba(232,200,74,0.55)' }} />

        {/* Top bar */}
        <div style={{
          padding: '16px 20px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: BEBAS, fontSize: 10, color: 'rgba(232,200,74,0.45)', letterSpacing: 3.5 }}>
            VOICES WORLD CUP 2026
          </div>
          {/* Live dot */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: MONO, fontSize: 8, color: 'rgba(232,200,74,0.5)', letterSpacing: 1,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#E8C84A',
              boxShadow: '0 0 0 2px rgba(232,200,74,0.2)',
              animation: 'glowPulse 2s ease-in-out infinite',
            }} />
            LIVE
          </div>
        </div>

        {/* Hero section */}
        <div style={{
          padding: '24px 20px 20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
          flexShrink: 0,
        }}>
          {/* Color swatch */}
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 16px ${accentColor}99`,
            marginBottom: 14,
          }} />

          {/* Flag */}
          <div style={{
            fontSize: 80, lineHeight: 1,
            marginBottom: 14,
            filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
          }}>
            {country?.flag ?? '🏳️'}
          </div>

          {/* Country name */}
          <div style={{
            fontFamily: BEBAS, fontSize: 36, letterSpacing: 5,
            color: '#ffffff', lineHeight: 1,
            marginBottom: 4,
            textShadow: '0 2px 20px rgba(0,0,0,0.5)',
          }}>
            {country?.name?.toUpperCase() ?? pixel.country_iso.toUpperCase()}
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 9, letterSpacing: 3,
            color: 'rgba(232,200,74,0.45)',
            marginBottom: 16,
          }}>
            COUPE DU MONDE 2026
          </div>

          {/* Pseudo badge */}
          {pixel.pseudo && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(232,200,74,0.08)',
              border: '1px solid rgba(232,200,74,0.22)',
              borderRadius: 20, padding: '5px 16px',
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: accentColor,
                boxShadow: `0 0 6px ${accentColor}`,
              }} />
              <span style={{
                fontFamily: MONO, fontSize: 12, color: '#E8C84A', letterSpacing: 1.5,
              }}>
                {pixel.pseudo}
              </span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(232,200,74,0.2), transparent)', margin: '0 20px', flexShrink: 0 }} />

        {/* Audio waveform player */}
        {pixel.audio_url && (
          <div style={{ padding: '18px 20px', flexShrink: 0 }}>
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(232,200,74,0.12)',
              borderRadius: 6,
              padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {/* Play button */}
              <button
                onClick={togglePlay}
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: playing
                    ? 'linear-gradient(135deg, #E8C84A, #c9a830)'
                    : 'linear-gradient(135deg, rgba(232,200,74,0.85), rgba(180,150,30,0.85))',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: '#0f1117', fontWeight: 'bold',
                  boxShadow: '0 2px 16px rgba(232,200,74,0.4)',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.93)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {playing ? '⏸' : '▶'}
              </button>

              {/* Waveform bars */}
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center',
                gap: 1.5, height: 40, overflow: 'hidden',
              }}>
                {BARS.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1, borderRadius: 2,
                      height: `${h * 100}%`,
                      background: playing
                        ? `rgba(232,200,74,${0.3 + h * 0.7})`
                        : `rgba(255,255,255,${0.08 + h * 0.12})`,
                      animation: playing
                        ? `waveBar ${0.35 + (i % 9) * 0.07}s ease-in-out ${(i % 6) * 0.04}s infinite alternate`
                        : 'none',
                      transition: 'background 0.3s',
                    }}
                  />
                ))}
              </div>

              <span style={{
                fontFamily: BEBAS, fontSize: 9, letterSpacing: 2,
                color: 'rgba(232,200,74,0.35)', flexShrink: 0,
              }}>
                VOIX
              </span>
            </div>
          </div>
        )}

        {/* Description */}
        {pixel.description && (
          <div style={{ padding: '0 20px 16px', flexShrink: 0 }}>
            <div style={{
              fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.75, letterSpacing: 0.3,
              borderLeft: '2px solid rgba(232,200,74,0.25)',
              paddingLeft: 12,
            }}>
              {pixel.description}
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ padding: '0 20px 16px', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={handleLike}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: liked ? 'rgba(255,80,80,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${liked ? 'rgba(255,80,80,0.35)' : 'rgba(255,255,255,0.09)'}`,
              color: liked ? '#ff7070' : 'rgba(255,255,255,0.45)',
              fontFamily: MONO, fontSize: 10, letterSpacing: 0.5,
              padding: '10px 0', cursor: 'pointer', borderRadius: 4,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 14 }}>{liked ? '❤️' : '♡'}</span>
            <span style={{ fontFamily: BEBAS, fontSize: 16, letterSpacing: 1 }}>{likeCount}</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>J'AIME</span>
          </button>
          <button
            onClick={() => setShowComments(o => !o)}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: showComments ? 'rgba(232,200,74,0.07)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showComments ? 'rgba(232,200,74,0.20)' : 'rgba(255,255,255,0.09)'}`,
              color: showComments ? 'rgba(232,200,74,0.8)' : 'rgba(255,255,255,0.45)',
              fontFamily: MONO, fontSize: 10, letterSpacing: 0.5,
              padding: '10px 0', cursor: 'pointer', borderRadius: 4,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 14 }}>💬</span>
            <span style={{ fontFamily: BEBAS, fontSize: 16, letterSpacing: 1 }}>{comments.length}</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>COMM.</span>
          </button>
        </div>

        {/* Comments panel */}
        {showComments && comments.length > 0 && (
          <div style={{
            margin: '0 20px 16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 4,
            maxHeight: 160, overflowY: 'auto',
            flexShrink: 0,
          }}>
            {comments.map((c, i) => (
              <div key={c.id} style={{
                padding: '8px 14px',
                borderBottom: i < comments.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.50)',
                lineHeight: 1.65,
              }}>
                {c.content}
              </div>
            ))}
          </div>
        )}

        {/* Flex spacer */}
        <div style={{ flex: 1 }} />

        {/* Divider */}
        <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(232,200,74,0.15), transparent)', margin: '0 20px', flexShrink: 0 }} />

        {/* CTA */}
        <div style={{ padding: '16px 20px 14px', flexShrink: 0 }}>
          <a
            href={SITE}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px 12px',
              background: 'linear-gradient(135deg, #E8C84A 0%, #d4b03a 50%, #c9a830 100%)',
              color: '#0f1117',
              fontFamily: BEBAS, fontSize: 14, letterSpacing: 2.5,
              textDecoration: 'none', borderRadius: 4,
              boxShadow: '0 4px 24px rgba(232,200,74,0.35)',
              textAlign: 'center', lineHeight: 1.3,
            }}
          >
            🌍 PLACER MA VOIX SUR LA CARTE — 1€/PIXEL
          </a>
        </div>

        {/* Bottom meta */}
        <div style={{
          padding: '0 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 7.5, color: 'rgba(232,200,74,0.25)',
            letterSpacing: 0.8, wordBreak: 'break-all',
          }}>
            {SITE}/pixel/{pixelId}
          </span>
          {pixel.created_at && (
            <span style={{
              fontFamily: MONO, fontSize: 7.5, color: 'rgba(255,255,255,0.18)',
              letterSpacing: 0.5, flexShrink: 0, marginLeft: 8,
            }}>
              {fmtDate(pixel.created_at)}
            </span>
          )}
        </div>
      </div>

      {/* ── Action buttons (outside card) ──────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 420,
        display: 'flex', gap: 10,
        marginTop: 14,
      }}>
        <button
          onClick={handleShare}
          style={{
            flex: 1,
            background: 'rgba(232,200,74,0.09)',
            border: '1px solid rgba(232,200,74,0.24)',
            color: shareMsg ? '#E8C84A' : 'rgba(232,200,74,0.8)',
            fontFamily: BEBAS, fontSize: 12, letterSpacing: 2,
            padding: '12px 0', cursor: 'pointer', borderRadius: 4,
            transition: 'all 0.15s',
          }}
        >
          {shareMsg ?? '🔗 PARTAGER'}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.11)',
            color: downloading ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)',
            fontFamily: BEBAS, fontSize: 12, letterSpacing: 2,
            padding: '12px 0', cursor: downloading ? 'default' : 'pointer', borderRadius: 4,
            transition: 'all 0.15s',
          }}
        >
          {downloading ? '⏳ GÉNÉRATION…' : '⬇ TÉLÉCHARGER'}
        </button>
      </div>

      {/* Back link */}
      <a href={SITE} style={{
        marginTop: 24,
        fontFamily: MONO, fontSize: 9, color: 'rgba(232,200,74,0.30)',
        letterSpacing: 1.5, textDecoration: 'none',
      }}>
        ← RETOUR À LA CARTE
      </a>
    </div>
  )
}
