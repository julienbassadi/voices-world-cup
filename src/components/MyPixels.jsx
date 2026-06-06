import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import useMapStore from '../store/mapStore'
import useAuthStore from '../store/authStore'
import { supabase } from '../lib/supabase'
import { QUALIFIED } from './WorldMap'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"

const SHARE_BASE = 'https://voicesworldcup.vercel.app'

export default function MyPixels({ onOpenVocalSpace, isDark }) {
  const [isOpen, setIsOpen]               = useState(false)
  const [commentCounts, setCommentCounts] = useState({})
  const [toastMsg, setToastMsg]           = useState(null)
  const toastTimerRef = useRef(null)

  const user            = useAuthStore(s => s.user)
  const isLoggedIn      = useAuthStore(s => s.isLoggedIn)
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

  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  const showToast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2000)
  }, [])

  const handlePlay = useCallback((px) => {
    useMapStore.getState().setClickedPixel(px.countryIso, px.id)
  }, [])

  const handleView = useCallback((px) => {
    const country = QUALIFIED.find(c => c.iso === px.countryIso)
    if (!country) return
    onOpenVocalSpace?.({ country, pixel: px })
  }, [onOpenVocalSpace])

  const handleShare = useCallback(async (px) => {
    const url = `${SHARE_BASE}/pixel/${px.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    showToast('Lien copié !')
  }, [showToast])

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
            <div style={{
              padding: '16px 12px',
              fontFamily: MONO, fontSize: 10, color: mutedColor,
              textAlign: 'center', letterSpacing: 0.5, lineHeight: 1.7,
            }}>
              Connectez-vous pour<br />retrouver vos pixels
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
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 88, right: 20,
          background: isDark ? 'rgba(5,8,15,0.95)' : 'rgba(232,237,248,0.97)',
          border: `1px solid ${accent}`,
          color: accent,
          fontFamily: MONO, fontSize: 11, letterSpacing: 1,
          padding: '8px 14px',
          zIndex: 2000, pointerEvents: 'none',
          animation: 'slideInRight 0.18s ease',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}>
          {toastMsg}
        </div>
      )}
    </>
  )
}
