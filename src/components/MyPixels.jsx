import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import useMapStore from '../store/mapStore'
import useAuthStore from '../store/authStore'
import { supabase } from '../lib/supabase'
import { QUALIFIED } from './WorldMap'
import PixelShareModal from './PixelShareModal'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"

export default function MyPixels({ onOpenVocalSpace, isDark, onOpenAuth, isMobile = false, forceClose = false, onOpen, onNavigateToPixel }) {
  const [isOpen, setIsOpen]               = useState(false)
  const [commentCounts, setCommentCounts] = useState({})
  const [sharePixel, setSharePixel]       = useState(null)
  const swipeRef   = useRef({ startX: 0 })
  const [swipeDelta, setSwipeDelta]       = useState(0)

  // Close when parent signals (e.g. ranking opened, or sidebar opened)
  useEffect(() => { if (forceClose) setIsOpen(false) }, [forceClose])

  // Swipe LEFT to close the left sidebar
  const onSwipeStart = e => {
    swipeRef.current.startX = e.touches[0].clientX
    setSwipeDelta(0)
  }
  const onSwipeMove = e => {
    const delta = e.touches[0].clientX - swipeRef.current.startX
    setSwipeDelta(delta) // negative = swiping left
  }
  const onSwipeEnd = () => {
    if (swipeDelta < -80) { setIsOpen(false); setSwipeDelta(0) }
    else setSwipeDelta(0)
  }

  const handleOpen = () => { onOpen?.(); setIsOpen(true) }
  const handleClose = () => { setIsOpen(false); setSwipeDelta(0) }

  const user            = useAuthStore(s => s.user)
  const isLoggedIn      = useAuthStore(s => s.isLoggedIn)
  const logout          = useAuthStore(s => s.logout)
  const pixelsByCountry = useMapStore(s => s.pixelsByCountry)

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

  useEffect(() => {
    if (!userPixels.length) { setCommentCounts({}); return }
    supabase
      .from('comments').select('pixel_id')
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
    if (isMobile) setIsOpen(false)
  }, [onOpenVocalSpace, isMobile])

  const handleShare = useCallback((px) => {
    const country = QUALIFIED.find(c => c.iso === px.countryIso)
    if (!country) return
    setSharePixel({ px, country })
  }, [])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const accent     = isDark ? '#E8C84A' : '#1e3a8a'
  const panelBg    = isDark ? 'rgba(5,8,15,0.95)' : 'rgba(232,237,248,0.98)'
  const mutedColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(30,58,138,0.52)'
  const dividerClr = isDark ? 'rgba(232,200,74,0.10)' : 'rgba(30,58,138,0.10)'

  const iconBtnStyle = {
    background: 'none',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.13)' : 'rgba(30,58,138,0.18)'}`,
    color: mutedColor,
    fontSize: isMobile ? 13 : 10,
    cursor: 'pointer',
    borderRadius: 2,
    padding: isMobile ? '6px 10px' : '2px 5px',
    lineHeight: 1.2,
    fontFamily: MONO, flexShrink: 0,
    minHeight: isMobile ? 36 : 'auto',
    minWidth: isMobile ? 36 : 'auto',
  }

  // ── Pixel row (shared) ─────────────────────────────────────────────────────
  const PixelRow = ({ px }) => {
    const country = QUALIFIED.find(c => c.iso === px.countryIso)
    if (!country) return null
    const cCount = commentCounts[px.id] ?? 0
    const handleRowClick = () => {
      handleClose()
      onNavigateToPixel?.({ iso: px.countryIso, gridX: px.gridX, gridY: px.gridY })
    }
    return (
      <div
        onClick={handleRowClick}
        style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 7,
          padding: isMobile ? '10px 14px' : '7px 10px',
          borderBottom: `1px solid ${dividerClr}`,
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(30,58,138,0.02)',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: isMobile ? 14 : 12, height: isMobile ? 14 : 12, flexShrink: 0, borderRadius: 1,
          background: px.color ?? '#E8C84A',
          border: '1px solid rgba(255,255,255,0.12)',
        }} />
        <span style={{ fontSize: isMobile ? 16 : 12, lineHeight: 1, flexShrink: 0 }}>{country.flag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: BEBAS, fontSize: isMobile ? 13 : 10, color: accent, letterSpacing: 1, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {country.name.toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
            <span style={{ fontFamily: MONO, fontSize: isMobile ? 10 : 8, color: mutedColor }}>♥ {px.likes}</span>
            <span style={{ fontFamily: MONO, fontSize: isMobile ? 10 : 8, color: mutedColor }}>💬 {cCount}</span>
          </div>
        </div>
        <div
          style={{ display: 'flex', gap: isMobile ? 6 : 3, flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => handlePlay(px)} style={iconBtnStyle} title="Écouter">▶</button>
          <button onClick={() => handleView(px)} style={iconBtnStyle} title="Voir">💬</button>
          <button onClick={() => handleShare(px)} style={iconBtnStyle} title="Partager">🔗</button>
        </div>
      </div>
    )
  }

  // ── Auth buttons (not logged in) ───────────────────────────────────────────
  const AuthButtons = () => (
    <div style={{ padding: isMobile ? '14px' : '10px 10px', display: 'flex', gap: 8 }}>
      <button
        onClick={() => { onOpenAuth?.('register'); if (isMobile) setIsOpen(false) }}
        style={{
          flex: 1,
          background: isDark ? 'linear-gradient(135deg, #E8C84A, #c9a830)' : 'linear-gradient(135deg, #1e3a8a, #2952c0)',
          border: 'none',
          color: isDark ? '#05080F' : '#ffffff',
          fontFamily: BEBAS, fontSize: isMobile ? 14 : 11, letterSpacing: 2,
          padding: isMobile ? '12px 0' : '8px 0', cursor: 'pointer', borderRadius: 3,
          minHeight: isMobile ? 48 : 'auto',
        }}
      >S'INSCRIRE</button>
      <button
        onClick={() => { onOpenAuth?.('login'); if (isMobile) setIsOpen(false) }}
        style={{
          flex: 1,
          background: 'none',
          border: `1px solid ${isDark ? 'rgba(232,200,74,0.30)' : 'rgba(30,58,138,0.25)'}`,
          color: isDark ? 'rgba(232,200,74,0.75)' : '#1e3a8a',
          fontFamily: BEBAS, fontSize: isMobile ? 14 : 11, letterSpacing: 2,
          padding: isMobile ? '12px 0' : '8px 0', cursor: 'pointer', borderRadius: 3,
          minHeight: isMobile ? 48 : 'auto',
        }}
      >SE CONNECTER</button>
    </div>
  )

  // ── Logout ─────────────────────────────────────────────────────────────────
  const LogoutBtn = () => (
    <div style={{ padding: isMobile ? '10px 14px 20px' : '8px 10px', borderTop: `1px solid ${dividerClr}` }}>
      <button
        onClick={() => { logout(); setIsOpen(false) }}
        style={{
          width: '100%',
          background: 'none',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(30,58,138,0.14)'}`,
          color: mutedColor,
          fontFamily: BEBAS, fontSize: isMobile ? 12 : 10, letterSpacing: 2,
          padding: isMobile ? '10px 0' : '6px 0', cursor: 'pointer', borderRadius: 3,
          minHeight: isMobile ? 44 : 'auto',
        }}
      >SE DÉCONNECTER</button>
    </div>
  )

  // ── Panel contents ─────────────────────────────────────────────────────────
  const PanelContents = () => (
    <>
      {!isLoggedIn ? (
        <AuthButtons />
      ) : userPixels.length === 0 ? (
        <div style={{
          padding: isMobile ? '20px 14px' : '16px 12px',
          fontFamily: MONO, fontSize: isMobile ? 12 : 10, color: mutedColor,
          textAlign: 'center', letterSpacing: 0.5, lineHeight: 1.7,
        }}>
          Vous n'avez pas encore<br />acheté de pixel
        </div>
      ) : (
        userPixels.map(px => <PixelRow key={px.id} px={px} />)
      )}
      {isLoggedIn && <LogoutBtn />}
    </>
  )

  // ── Toggle button (shared) ─────────────────────────────────────────────────
  const ToggleBtn = () => (
    <button
      onClick={() => isOpen ? handleClose() : handleOpen()}
      style={{
        background: isDark ? 'rgba(5,8,15,0.82)' : 'rgba(232,237,248,0.95)',
        border: `1px solid ${dividerClr}`,
        color: accent,
        fontFamily: BEBAS, fontSize: isMobile ? 13 : 12, letterSpacing: 2,
        cursor: 'pointer', padding: isMobile ? '8px 12px' : '5px 10px',
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%', justifyContent: 'space-between',
        backdropFilter: 'blur(6px)',
        minHeight: isMobile ? 44 : 'auto',
        borderRadius: isMobile ? 4 : 0,
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
  )

  // ── MOBILE: left sidebar ──────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <ToggleBtn />

        {isOpen && (
          <>
            {/* Backdrop — click to close */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.55)' }}
              onClick={handleClose}
            />

            {/* Left sidebar — swipe left to close */}
            <div
              onTouchStart={onSwipeStart}
              onTouchMove={onSwipeMove}
              onTouchEnd={onSwipeEnd}
              style={{
                position: 'fixed', top: 0, left: 0, bottom: 0,
                width: 300,
                background: panelBg,
                borderRight: `2px solid ${accent}`,
                zIndex: 1201,
                display: 'flex', flexDirection: 'column',
                animation: swipeDelta === 0 ? 'slideInLeft 0.25s cubic-bezier(0.16,1,0.3,1)' : 'none',
                transform: `translateX(${Math.min(0, swipeDelta)}px)`,
                transition: swipeDelta === 0 ? 'transform 0.2s ease' : 'none',
                touchAction: 'pan-y',
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 16px 12px',
                borderBottom: `1px solid ${dividerClr}`,
                flexShrink: 0,
              }}>
                <div style={{ fontFamily: BEBAS, fontSize: 18, color: accent, letterSpacing: 2 }}>
                  MES PIXELS
                  {isLoggedIn && userPixels.length > 0 && (
                    <span style={{ opacity: 0.6, marginLeft: 6, fontSize: 14 }}>({userPixels.length})</span>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  style={{
                    background: 'none', border: 'none', color: mutedColor,
                    fontSize: 20, cursor: 'pointer', lineHeight: 1, fontFamily: MONO,
                    minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              </div>

              {/* Scrollable content */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <PanelContents />
              </div>
            </div>
          </>
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

  // ── DESKTOP: dropdown panel ────────────────────────────────────────────────
  return (
    <>
      <ToggleBtn />

      {isOpen && (
        <div style={{
          background: panelBg,
          border: `1px solid ${dividerClr}`,
          borderTop: 'none',
          maxHeight: 320,
          overflowY: 'auto',
          backdropFilter: 'blur(8px)',
        }}>
          <PanelContents />
        </div>
      )}

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
