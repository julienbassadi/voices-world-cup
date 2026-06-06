import { useState, useEffect, useMemo, useRef } from 'react'
import useMapStore from '../store/mapStore'
import { QUALIFIED } from './WorldMap'
import MyPixels from './MyPixels'
import { useMobile } from '../hooks/useMobile'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"
const TARGET = new Date('2026-07-19T20:00:00')
const MEDAL_ICONS  = ['🥇', '🥈', '🥉']
const MEDAL_COLORS = ['#E8C84A', '#C0C0C0', '#CD7F32']

function useCountdown() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const diff = Math.max(0, TARGET - now)
  const pad  = n => String(Math.floor(n)).padStart(2, '0')
  return {
    jj: pad(diff / 86400000),
    hh: pad((diff % 86400000) / 3600000),
    mm: pad((diff % 3600000) / 60000),
    ss: pad((diff % 60000) / 1000),
  }
}

const fmtVoix = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

export default function HUD({ lastHoveredCountry, onOpenSidebar, onOpenVocalSpace, onOpenAuth, sidebarOpen = false }) {
  const { jj, hh, mm, ss } = useCountdown()
  const isMobile = useMobile()

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const rankSwipeRef   = useRef({ startX: 0 })
  const [rankSwipeDelta, setRankSwipeDelta] = useState(0)

  const onRankSwipeStart = e => { rankSwipeRef.current.startX = e.touches[0].clientX; setRankSwipeDelta(0) }
  const onRankSwipeMove  = e => { setRankSwipeDelta(e.touches[0].clientX - rankSwipeRef.current.startX) }
  const onRankSwipeEnd   = () => {
    if (rankSwipeDelta < -50) { setMobileMenuOpen(false); setRankSwipeDelta(0) }
    else setRankSwipeDelta(0)
  }

  // One panel at a time: close ranking when sidebar/VocalSpace opens
  useEffect(() => {
    if (sidebarOpen) setMobileMenuOpen(false)
  }, [sidebarOpen])

  const pixelsByCountry = useMapStore(s => s.pixelsByCountry)
  const totalVoices     = useMapStore(s => s.totalVoices)

  const ranking = useMemo(() => {
    return Object.entries(pixelsByCountry)
      .map(([iso, arr]) => ({ iso, count: arr?.length ?? 0, country: QUALIFIED.find(c => c.iso === iso) }))
      .filter(e => e.country && e.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [pixelsByCountry])

  const isDark  = theme === 'dark'
  const canOpen = !!lastHoveredCountry
  const hoveredVoix = canOpen ? (pixelsByCountry[lastHoveredCountry.iso] ?? []).length : 0

  const accent   = isDark ? '#E8C84A' : '#1a3080'
  const leftBg   = isDark
    ? 'linear-gradient(to right, rgba(5,8,15,0.90) 0%, rgba(5,8,15,0.62) 72%, transparent 100%)'
    : 'linear-gradient(to right, rgba(232,237,248,0.97) 0%, rgba(232,237,248,0.70) 72%, transparent 100%)'
  const topBg    = isDark ? 'rgba(5,8,15,0.55)' : 'rgba(232,237,248,0.75)'
  const bottomBg = isDark ? 'rgba(5,8,15,0.93)' : 'rgba(232,237,248,0.95)'

  const iconBtn = {
    background: isDark ? 'none' : 'rgba(26,48,128,0.06)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(26,48,128,0.18)'}`,
    color: isDark ? 'rgba(255,255,255,0.5)' : '#1a3080',
    fontSize: 13, cursor: 'pointer',
    borderRadius: 2, padding: '5px 8px', lineHeight: 1,
    minWidth: 32, minHeight: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  // ── Title block ──────────────────────────────────────────────────────────────
  const VWCTitle = ({ size = 20 }) => (
    <div style={{ fontFamily: BEBAS, fontSize: size, color: accent, letterSpacing: 3, lineHeight: 1, flexShrink: 0 }}>
      VOICES WORLD CUP
    </div>
  )

  // ── Ranking rows (without title) ─────────────────────────────────────────────
  const RankingRows = () => (
    <>
      {ranking.map(({ iso, count, country }, i) => {
        const color = i < 3 ? MEDAL_COLORS[i] : '#4a5060'
        return (
          <div key={iso} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, flexShrink: 0 }}>
            <span style={{ width: 18, textAlign: 'center', lineHeight: 1, flexShrink: 0, fontSize: i < 3 ? 11 : 9, fontFamily: MONO, color }}>
              {i < 3 ? MEDAL_ICONS[i] : `${i + 1}.`}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{country.flag}</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color, letterSpacing: 0.5, flex: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {country.name}
            </span>
            <span style={{ fontFamily: BEBAS, fontSize: 13, color, letterSpacing: 1, flexShrink: 0 }}>
              {fmtVoix(count)}
            </span>
          </div>
        )
      })}
    </>
  )

  // ── Countdown digits (shared) ────────────────────────────────────────────────
  const CountdownUI = ({ compact = false }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {[['JJ', jj], ['HH', hh], ['MM', mm], ['SS', ss]].map(([l, v], i) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && (
            <span style={{ fontFamily: BEBAS, fontSize: compact ? 16 : 20, color: isDark ? 'rgba(232,200,74,0.3)' : 'rgba(26,48,128,0.22)', margin: '0 1px', paddingBottom: compact ? 4 : 6 }}>:</span>
          )}
          <div style={{ textAlign: 'center', minWidth: compact ? 20 : 26 }}>
            <div style={{ fontFamily: BEBAS, fontSize: compact ? 20 : 24, color: isDark ? '#ffffff' : '#0d1230', lineHeight: 1 }}>{v}</div>
            <div style={{ fontFamily: MONO, fontSize: compact ? 6 : 7, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(13,18,48,0.5)', letterSpacing: 1 }}>{l}</div>
          </div>
        </div>
      ))}
    </div>
  )

  // ── MOBILE LAYOUT ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }}>

        {/* Top gradient */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 64,
          background: `linear-gradient(to bottom, ${isDark ? 'rgba(5,8,15,0.88)' : 'rgba(232,237,248,0.92)'} 0%, transparent 100%)`,
          pointerEvents: 'none',
        }} />

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 52,
          display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: 10,
          pointerEvents: 'auto',
        }}>
          {/* Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            style={{ ...iconBtn, fontSize: 16, minWidth: 40, minHeight: 40 }}
            title="Classement"
          >
            ☰
          </button>

          {/* Title */}
          <div style={{ fontFamily: BEBAS, fontSize: 11, letterSpacing: 2, color: accent, lineHeight: 1, flexShrink: 0, pointerEvents: 'none' }}>
            VOICES WORLD CUP
          </div>

          {/* Countdown centered in remaining space */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <CountdownUI compact />
          </div>

          {/* Theme */}
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ ...iconBtn, minWidth: 40, minHeight: 40 }} title="Thème">
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Mes Pixels — top right, below top bar (hidden when sidebar open) */}
        {!sidebarOpen && (
          <div style={{ position: 'absolute', top: 52, right: 12, left: 12, pointerEvents: 'auto' }}>
            <MyPixels
              onOpenVocalSpace={onOpenVocalSpace} isDark={isDark} onOpenAuth={onOpenAuth} isMobile
              forceClose={mobileMenuOpen || sidebarOpen}
              onOpen={() => setMobileMenuOpen(false)}
            />
          </div>
        )}

        {/* Mobile ranking drawer (slide from left) */}
        {mobileMenuOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              onTouchStart={onRankSwipeStart}
              onTouchMove={onRankSwipeMove}
              onTouchEnd={onRankSwipeEnd}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 0, left: 0, bottom: 0, width: 260,
                background: isDark ? 'rgba(5,8,15,0.97)' : 'rgba(232,237,248,0.99)',
                borderRight: `2px solid ${accent}`,
                padding: '20px 18px 90px 18px',
                overflowY: 'auto',
                animation: rankSwipeDelta === 0 ? 'slideInLeft 0.25s cubic-bezier(0.16,1,0.3,1)' : 'none',
                transform: `translateX(${Math.min(0, rankSwipeDelta)}px)`,
                transition: rankSwipeDelta === 0 ? 'transform 0.2s ease' : 'none',
                display: 'flex', flexDirection: 'column',
                touchAction: 'pan-y',
              }}
            >
              <VWCTitle size={16} />
              <div style={{ marginTop: 14 }}>
                <RankingRows />
              </div>
            </div>
          </div>
        )}

        {/* Bottom gradient + CTA (hidden when sidebar open) */}
        {!sidebarOpen && (
          <>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
              background: `linear-gradient(to top, ${bottomBg} 0%, transparent 100%)`,
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '0 14px 28px',
              pointerEvents: 'auto',
            }}>
              <button
                onClick={canOpen ? onOpenSidebar : undefined}
                style={{
                  width: '100%',
                  minHeight: 52,
                  background: canOpen
                    ? (isDark ? 'linear-gradient(135deg, #E8C84A 0%, #c9a830 100%)' : 'linear-gradient(135deg, #1a3080 0%, #2a45b0 100%)')
                    : (isDark ? 'rgba(232,200,74,0.1)' : 'rgba(26,48,128,0.08)'),
                  border: 'none',
                  color: canOpen ? (isDark ? '#05080F' : '#ffffff') : (isDark ? 'rgba(232,200,74,0.28)' : 'rgba(26,48,128,0.28)'),
                  fontFamily: BEBAS, fontSize: 15, letterSpacing: 3,
                  cursor: canOpen ? 'pointer' : 'default',
                  borderRadius: 4,
                  transition: 'background 0.2s, color 0.2s',
                  whiteSpace: 'nowrap',
                  boxShadow: (!isDark && canOpen) ? '0 2px 12px rgba(26,48,128,0.2)' : 'none',
                }}
              >
                {canOpen
                  ? `${lastHoveredCountry.flag} ${lastHoveredCountry.name.toUpperCase()} — ${fmtVoix(hoveredVoix)} VOIX`
                  : 'PLACER MA VOIX — 1€ / PIXEL'}
              </button>
            </div>
          </>
        )}

      </div>
    )
  }

  // ── DESKTOP LAYOUT ──────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }}>

      {/* Left panel: sticky title + scrollable ranking */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: 264,
        background: leftBg,
        boxShadow: isDark ? 'none' : '4px 0 18px rgba(0,0,0,0.07)',
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'auto',
      }}>
        {/* Title — never scrolls away */}
        <div style={{ padding: '14px 18px 10px 20px', flexShrink: 0 }}>
          <VWCTitle size={20} />
        </div>
        {/* Ranking list — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 90px 20px' }}>
          <RankingRows />
        </div>
      </div>

      {/* Top gradient */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: `linear-gradient(to bottom, ${topBg} 0%, transparent 100%)`,
        pointerEvents: 'none',
      }} />

      {/* Countdown (centered) */}
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <CountdownUI />
      </div>

      {/* Top right: X VOIX + theme */}
      <div style={{ position: 'absolute', top: 12, right: 20, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
        <div style={{ fontFamily: BEBAS, fontSize: 20, color: accent, letterSpacing: 2, lineHeight: 1 }}>
          {fmtVoix(totalVoices)} VOIX
        </div>
        <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title={isDark ? 'Mode clair' : 'Mode sombre'} style={iconBtn}>
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Top right: Mes Pixels panel (hidden when sidebar open) */}
      {!sidebarOpen && (
        <div style={{ position: 'absolute', top: 50, right: 20, width: 272, pointerEvents: 'auto' }}>
          <MyPixels onOpenVocalSpace={onOpenVocalSpace} isDark={isDark} onOpenAuth={onOpenAuth} forceClose={sidebarOpen} />
        </div>
      )}

      {/* Bottom: hexagonal CTA (hidden when sidebar open) */}
      {!sidebarOpen && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 76,
          background: `linear-gradient(to top, ${bottomBg} 0%, transparent 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <button
            onClick={canOpen ? onOpenSidebar : undefined}
            style={{
              pointerEvents: 'auto',
              clipPath: 'polygon(18px 0%, calc(100% - 18px) 0%, 100% 50%, calc(100% - 18px) 100%, 18px 100%, 0% 50%)',
              background: canOpen
                ? (isDark ? 'linear-gradient(135deg, #E8C84A 0%, #c9a830 100%)' : 'linear-gradient(135deg, #1a3080 0%, #2a45b0 100%)')
                : (isDark ? 'rgba(232,200,74,0.1)' : 'rgba(26,48,128,0.08)'),
              border: 'none',
              color: canOpen ? (isDark ? '#05080F' : '#ffffff') : (isDark ? 'rgba(232,200,74,0.28)' : 'rgba(26,48,128,0.28)'),
              fontFamily: BEBAS, fontSize: 15, letterSpacing: 3,
              padding: '13px 52px',
              cursor: canOpen ? 'pointer' : 'default',
              transition: 'background 0.2s, color 0.2s',
              whiteSpace: 'nowrap',
              boxShadow: (!isDark && canOpen) ? '0 2px 12px rgba(26,48,128,0.2)' : 'none',
            }}
          >
            {canOpen
              ? `${lastHoveredCountry.flag} ${lastHoveredCountry.name.toUpperCase()} — ${fmtVoix(hoveredVoix)} VOIX`
              : 'PLACER MA VOIX — 1€ / PIXEL'}
          </button>
        </div>
      )}

    </div>
  )
}
