import { useState, useRef, useCallback, useEffect } from 'react'
import html2canvas from 'html2canvas'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"
const SITE  = 'https://voicesworldcup.vercel.app'

// Seeded stable bars (same as PixelPage)
function makeBars(n = 44) {
  return Array.from({ length: n }, (_, i) => {
    const x = Math.sin(i * 127.1) * 43758.5453
    return 0.15 + Math.abs(x - Math.floor(x)) * 0.85
  })
}
const BARS = makeBars()

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// pixel: camelCase store shape  (id, audioUrl, pseudo, description, color, likes, createdAt)
// country: { iso, name, flag }
export default function PixelShareModal({ pixel, country, commentCount = 0, onClose }) {
  const [playing, setPlaying]     = useState(false)
  const [copied, setCopied]       = useState(false)
  const [downloading, setDownloading] = useState(false)

  const audioRef  = useRef(null)
  const cardRef   = useRef(null)
  const copyTimer = useRef(null)

  useEffect(() => () => {
    clearTimeout(copyTimer.current)
    audioRef.current?.pause()
  }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const togglePlay = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play().catch(() => {}); setPlaying(true) }
  }, [playing])

  const handleCopy = useCallback(async () => {
    const url = `${SITE}/pixel/${pixel.id}`
    try { await navigator.clipboard.writeText(url) } catch {
      const ta = Object.assign(document.createElement('textarea'), {
        value: url, style: 'position:fixed;opacity:0',
      })
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2200)
  }, [pixel.id])

  const handleDownload = useCallback(async () => {
    if (!cardRef.current || downloading) return
    setDownloading(true)
    try {
      const el = cardRef.current
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
      a.download = `voix-${pixel.id}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } catch (err) {
      console.error('html2canvas:', err)
    } finally {
      setDownloading(false)
    }
  }, [pixel.id, downloading])

  const accentColor = pixel.color ?? '#E8C84A'
  const shareUrl = `${SITE}/pixel/${pixel.id}`

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(4px)',
        animation: 'fadeInBg 0.18s ease',
      }}
    >
      {/* Hidden audio */}
      {pixel.audioUrl && (
        <audio ref={audioRef} src={pixel.audioUrl} onEnded={() => setPlaying(false)} preload="metadata" />
      )}

      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 14,
          maxHeight: '100vh',
          overflowY: 'auto',
          width: '100%',
          maxWidth: 340,
        }}
      >
        {/* ── Instruction + close row ─────────────────────────────────── */}
        <div style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10,
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 11, color: '#E8C84A',
            letterSpacing: 0.5, lineHeight: 1.5,
          }}>
            📸 Fais un screenshot et partage en story !
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.55)',
              fontFamily: MONO, fontSize: 14,
              width: 28, height: 28, flexShrink: 0,
              cursor: 'pointer', borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Story card (capturable) ─────────────────────────────────── */}
        <div
          ref={cardRef}
          style={{
            width: 300,
            // 9:16 at 300px = 533px
            minHeight: 533,
            background: 'linear-gradient(170deg, #161c28 0%, #0f1117 50%, #0a0c13 100%)',
            border: '1.5px solid rgba(232,200,74,0.22)',
            boxShadow: '0 0 0 1px rgba(232,200,74,0.05)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', position: 'relative',
            flexShrink: 0,
          }}
        >
          {/* Corner accents */}
          {[
            { top: 0, left: 0, borderTop: true, borderLeft: true },
            { top: 0, right: 0, borderTop: true, borderRight: true },
            { bottom: 0, left: 0, borderBottom: true, borderLeft: true },
            { bottom: 0, right: 0, borderBottom: true, borderRight: true },
          ].map((pos, i) => (
            <div key={i} style={{
              position: 'absolute',
              ...Object.fromEntries(
                ['top','right','bottom','left'].filter(k => pos[k] !== undefined && pos[k] !== true && pos[k] !== false)
                  .map(k => [k, pos[k]])
              ),
              ...(pos.top    === 0 ? { top: 0 }    : {}),
              ...(pos.right  === 0 ? { right: 0 }  : {}),
              ...(pos.bottom === 0 ? { bottom: 0 } : {}),
              ...(pos.left   === 0 ? { left: 0 }   : {}),
              width: 20, height: 20,
              borderTop:    pos.borderTop    ? '2px solid rgba(232,200,74,0.55)' : 'none',
              borderRight:  pos.borderRight  ? '2px solid rgba(232,200,74,0.55)' : 'none',
              borderBottom: pos.borderBottom ? '2px solid rgba(232,200,74,0.55)' : 'none',
              borderLeft:   pos.borderLeft   ? '2px solid rgba(232,200,74,0.55)' : 'none',
            }} />
          ))}

          {/* Top bar */}
          <div style={{
            padding: '12px 14px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ fontFamily: BEBAS, fontSize: 8, color: 'rgba(232,200,74,0.45)', letterSpacing: 3 }}>
              SUPPORTERS WORLD CUP 2026
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: MONO, fontSize: 7, color: 'rgba(232,200,74,0.45)', letterSpacing: 1 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#E8C84A', boxShadow: '0 0 5px #E8C84A',
              }} />
              LIVE
            </div>
          </div>

          {/* Hero */}
          <div style={{
            padding: '16px 14px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: accentColor, boxShadow: `0 0 10px ${accentColor}88`,
              marginBottom: 10,
            }} />
            <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10,
              filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.5))' }}>
              {country?.flag ?? '🏳️'}
            </div>
            <div style={{ fontFamily: BEBAS, fontSize: 24, letterSpacing: 4,
              color: '#ffffff', lineHeight: 1, marginBottom: 3 }}>
              {country?.name?.toUpperCase() ?? pixel.countryIso?.toUpperCase()}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: 3,
              color: 'rgba(232,200,74,0.40)', marginBottom: 10 }}>
              COUPE DU MONDE 2026
            </div>
            {pixel.pseudo && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(232,200,74,0.08)',
                border: '1px solid rgba(232,200,74,0.20)',
                borderRadius: 20, padding: '3px 12px',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%',
                  background: accentColor, boxShadow: `0 0 4px ${accentColor}` }} />
                <span style={{ fontFamily: MONO, fontSize: 9, color: '#E8C84A', letterSpacing: 1 }}>
                  {pixel.pseudo}
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'linear-gradient(to right,transparent,rgba(232,200,74,0.18),transparent)',
            margin: '0 14px', flexShrink: 0 }} />

          {/* Waveform player */}
          {pixel.audioUrl && (
            <div style={{ padding: '12px 14px', flexShrink: 0 }}>
              <div style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(232,200,74,0.12)',
                borderRadius: 4,
                padding: '8px 10px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <button
                  onClick={togglePlay}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #E8C84A, #c9a830)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#0f1117',
                    boxShadow: '0 2px 10px rgba(232,200,74,0.4)',
                  }}
                >
                  {playing ? '⏸' : '▶'}
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, height: 28 }}>
                  {BARS.map((h, i) => (
                    <div key={i} style={{
                      flex: 1, borderRadius: 1,
                      height: `${h * 100}%`,
                      background: playing
                        ? `rgba(232,200,74,${0.3 + h * 0.7})`
                        : `rgba(255,255,255,${0.07 + h * 0.1})`,
                      animation: playing
                        ? `waveBar ${0.35 + (i % 9) * 0.07}s ease-in-out ${(i % 6) * 0.04}s infinite alternate`
                        : 'none',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
                <span style={{ fontFamily: BEBAS, fontSize: 7, letterSpacing: 2,
                  color: 'rgba(232,200,74,0.30)', flexShrink: 0 }}>VOIX</span>
              </div>
            </div>
          )}

          {/* Description */}
          {pixel.description && (
            <div style={{ padding: '0 14px 10px', flexShrink: 0 }}>
              <div style={{
                fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.52)',
                lineHeight: 1.7, letterSpacing: 0.3,
                borderLeft: '2px solid rgba(232,200,74,0.22)',
                paddingLeft: 8,
              }}>
                {pixel.description}
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ padding: '0 14px 12px', display: 'flex', gap: 8, flexShrink: 0 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.40)',
              fontFamily: MONO, fontSize: 9,
              padding: '7px 0', borderRadius: 3,
            }}>
              <span>♡</span>
              <span style={{ fontFamily: BEBAS, fontSize: 12, letterSpacing: 1 }}>{pixel.likes ?? 0}</span>
              <span style={{ fontSize: 7, opacity: 0.7 }}>J'AIME</span>
            </div>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.40)',
              fontFamily: MONO, fontSize: 9,
              padding: '7px 0', borderRadius: 3,
            }}>
              <span>💬</span>
              <span style={{ fontFamily: BEBAS, fontSize: 12, letterSpacing: 1 }}>{commentCount}</span>
              <span style={{ fontSize: 7, opacity: 0.7 }}>COMM.</span>
            </div>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Divider */}
          <div style={{ height: 1, background: 'linear-gradient(to right,transparent,rgba(232,200,74,0.13),transparent)',
            margin: '0 14px', flexShrink: 0 }} />

          {/* CTA */}
          <div style={{ padding: '10px 14px 8px', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '11px 8px',
              background: 'linear-gradient(135deg, #E8C84A 0%, #d4b03a 50%, #c9a830 100%)',
              color: '#0f1117',
              fontFamily: BEBAS, fontSize: 10, letterSpacing: 2,
              textAlign: 'center', lineHeight: 1.3, borderRadius: 3,
              boxShadow: '0 3px 16px rgba(232,200,74,0.30)',
            }}>
              🌍 PLACER MA VOIX SUR LA CARTE — 1€/PIXEL
            </div>
          </div>

          {/* Bottom URL + date */}
          <div style={{
            padding: '0 14px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 6, color: 'rgba(232,200,74,0.22)',
              letterSpacing: 0.6, wordBreak: 'break-all' }}>
              {shareUrl}
            </span>
            {pixel.createdAt && (
              <span style={{ fontFamily: MONO, fontSize: 6, color: 'rgba(255,255,255,0.15)',
                letterSpacing: 0.4, flexShrink: 0, marginLeft: 6 }}>
                {fmtDate(pixel.createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* ── Action buttons ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, width: 300, flexShrink: 0 }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              flex: 1,
              background: downloading ? 'rgba(232,200,74,0.06)' : 'linear-gradient(135deg, #E8C84A, #c9a830)',
              border: 'none',
              color: downloading ? 'rgba(232,200,74,0.35)' : '#0f1117',
              fontFamily: BEBAS, fontSize: 12, letterSpacing: 2,
              padding: '12px 0', cursor: downloading ? 'default' : 'pointer', borderRadius: 3,
              boxShadow: downloading ? 'none' : '0 2px 12px rgba(232,200,74,0.25)',
              transition: 'all 0.15s',
            }}
          >
            {downloading ? '⏳ GÉNÉRATION…' : '⬇ TÉLÉCHARGER'}
          </button>
          <button
            onClick={handleCopy}
            style={{
              flex: 1,
              background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.14)'}`,
              color: copied ? '#22C55E' : 'rgba(255,255,255,0.60)',
              fontFamily: BEBAS, fontSize: 12, letterSpacing: 2,
              padding: '12px 0', cursor: 'pointer', borderRadius: 3,
              transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ LIEN COPIÉ' : '🔗 COPIER LE LIEN'}
          </button>
        </div>
      </div>
    </div>
  )
}
