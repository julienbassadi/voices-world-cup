import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import useMapStore from '../store/mapStore'
import useAuthStore from '../store/authStore'
import { supabase } from '../lib/supabase'
import { QUALIFIED } from './WorldMap'
import PixelShareModal from './PixelShareModal'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"


export default function MyPixels({ onOpenVocalSpace, isDark, onOpenAuth }) {
  const [isOpen, setIsOpen]               = useState(false)
  const [commentCounts, setCommentCounts] = useState({})
  const [sharePixel, setSharePixel]       = useState(null) // { px, country }

  const user            = useAuthStore(s => s.user)
  const isLoggedIn      = useAuthStore(s => s.isLoggedIn)
  const logout          = useAuthStore(s => s.logout)
  const pixelsByCountry = useMapStore(s => s.pixelsByCountry)

  // Derive the current user's pixels from the global store (stays in sync with realtime)
  const userPixels = useMemo(() => {
    if (!user?.id) return []
    const result = []
    for (const [iso, pixels] of Object.entries(pixelsByCountry)) {
      for (const px of pixels) {
        if (px.userId === user.id) result.push({ ...px, countryIso: iso })
      }
    }
    return result.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  }, [pixelsByCountry, user?.id])

  // Reload comment counts whenever the user pixel list length changes
  useEffect(() => {
    if (!userPixels.length) { setCommentCounts({}); return }
    supabase
      .from('comments')
      .select('pixel_id')
      .in('pixel_id', userPixels.map(p => p.id))
      .then(({ data }) => {
        const counts = {}
        for (const c of (data ?? [])) counts[c.pixel_id] = (counts[c.pixel_id] ?? 0) + 1
        setCommentCounts(counts)
      })
  }, [userPixels.length])

  const handlePlay = useCallback((px) => {
    useMapStore.getState().setClickedPixel(px.countryIso, px.id)
  }, [])

  const handleView = useCallback((px) => {
    const country = QUALIFIED.find(c => c.iso === px.countryIso)
    if (!country) return
    onOpenVocalSpace?.({ country, pixel: px })
  }, [onOpenVocalSpace])

  const handleShare = useCallback((px) => {
    const country = QUALIFIED.find(c => c.iso === px.countryIso)
    if (!country) return
    setSharePixel({ px, country })
  }, [])

  // ── Styles ────────────────────────────────────────────────────────────────
  const accent     = isDark ? '#E8C84A' : '#1a3080'
  const panelBg    = isDark ? 'rgba(5,8,15,0.90)' : 'rgba(232,237,248,0.97)'
  const mutedColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(26,48,128,0.52)'
  const dividerClr = isDark ? 'rgba(232,200,74,0.10)' : 'rgba(26,48,128,0.10)'
  const rowHoverBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(26,48,128,0.03)'

  const iconBtnStyle = {
    background: 'none',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.13)' : 'rgba(26,48,128,0.18)'}`,
    color: mutedColor,
    fontSize: 10, cursor: 'pointer',
    borderRadius: 2, padding: '2px 5px', lineHeight: 1.2,
    fontFamily: MONO, flexShrink: 0,
  }

  return (
    <>
      {/* ── Toggle header ── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          background: isDark ? 'rgba(5,8,15,0.78)' : 'rgba(232,237,248,0.94)',
          border: `1px solid ${dividerClr}`,
          color: accent,
          fontFamily: BEBAS, fontSize: 12, letterSpacing: 2,
          cursor: 'pointer', padding: '5px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', justifyContent: 'space-between',
          boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.07)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span>
          MES PIXELS
          {isLoggedIn && userPixels.length > 0 && (
            <span style={{ opacity: 0.7, marginLeft: 5 }}>({userPixels.length})</span>
          )}
        </span>
        <span style={{ fontSize: 7, opacity: 0.6, fontFamily: MONO, transform: isOpen ? 'none' : 'rotate(180deg)', display: 'inline-block' }}>▲</span>
      </button>

      {/* ── Panel ── */}
      {isOpen && (
        <div style={{
          background: panelBg,
          border: `1px solid ${dividerClr}`,
          borderTop: 'none',
          maxHeight: 320,
          overflowY: 'auto',
          backdropFilter: 'blur(8px)',
        }}>
          {!isLoggedIn ? (
            <div style={{ padding: '10px 10px', display: 'flex', gap: 8 }}>
              <button
                onClick={() => onOpenAuth?.('register')}
                style={{
                  flex: 1,
                  background: isDark
                    ? 'linear-gradient(135deg, #E8C84A, #c9a830)'
                    : 'linear-gradient(135deg, #1a3080, #2a45b0)',
                  border: 'none',
                  color: isDark ? '#05080F' : '#ffffff',
                  fontFamily: BEBAS, fontSize: 11, letterSpacing: 2,
                  padding: '8px 0', cursor: 'pointer', borderRadius: 2,
                }}
              >
                S'INSCRIRE
              </button>
              <button
                onClick={() => onOpenAuth?.('login')}
                style={{
                  flex: 1,
                  background: 'none',
                  border: `1px solid ${isDark ? 'rgba(232,200,74,0.30)' : 'rgba(26,48,128,0.25)'}`,
                  color: isDark ? 'rgba(232,200,74,0.75)' : '#1a3080',
                  fontFamily: BEBAS, fontSize: 11, letterSpacing: 2,
                  padding: '8px 0', cursor: 'pointer', borderRadius: 2,
                }}
              >
                SE CONNECTER
              </button>
            </div>
          ) : userPixels.length === 0 ? (
            <div style={{
              padding: '16px 12px',
              fontFamily: MONO, fontSize: 10, color: mutedColor,
              textAlign: 'center', letterSpacing: 0.5, lineHeight: 1.7,
            }}>
              Vous n'avez pas encore<br />acheté de pixel
            </div>
          ) : userPixels.map(px => {
            const country = QUALIFIED.find(c => c.iso === px.countryIso)
            if (!country) return null
            const cCount = commentCounts[px.id] ?? 0
            return (
              <div key={px.id} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 10px',
                borderBottom: `1px solid ${dividerClr}`,
                background: rowHoverBg,
              }}>
                {/* Color swatch */}
                <div style={{
                  width: 12, height: 12, flexShrink: 0, borderRadius: 1,
                  background: px.color ?? '#E8C84A',
                  border: '1px solid rgba(255,255,255,0.12)',
                }} />

                {/* Flag */}
                <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>{country.flag}</span>

                {/* Name + stats */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: BEBAS, fontSize: 10, color: accent,
                    letterSpacing: 1, lineHeight: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {country.name.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: mutedColor }}>♥ {px.likes}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: mutedColor }}>💬 {cCount}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  <button onClick={() => handlePlay(px)} style={iconBtnStyle} title="Écouter">▶</button>
                  <button onClick={() => handleView(px)} style={iconBtnStyle} title="Voir les commentaires">💬</button>
                  <button onClick={() => handleShare(px)} style={iconBtnStyle} title="Copier le lien">🔗</button>
                </div>
              </div>
            )
          })}
          {/* Logout button — only shown when logged in */}
          {isLoggedIn && (
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${dividerClr}` }}>
              <button
                onClick={() => logout()}
                style={{
                  width: '100%',
                  background: 'none',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(26,48,128,0.14)'}`,
                  color: mutedColor,
                  fontFamily: BEBAS, fontSize: 10, letterSpacing: 2,
                  padding: '6px 0', cursor: 'pointer', borderRadius: 2,
                  transition: 'opacity 0.15s',
                }}
              >
                SE DÉCONNECTER
              </button>
            </div>
          )}
        </div>
      )}

      {/* Share modal */}
      {sharePixel && (
        <PixelShareModal
          pixel={sharePixel.px}
          country={sharePixel.country}
          commentCount={commentCounts[sharePixel.px.id] ?? 0}
          onClose={() => setSharePixel(null)}
        />
      )}
    </>
  )
}
