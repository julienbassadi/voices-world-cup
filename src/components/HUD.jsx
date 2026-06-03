import { useState, useEffect, useMemo } from 'react'
import useMapStore from '../store/mapStore'
import { QUALIFIED } from './WorldMap'

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

export default function HUD({ lastHoveredCountry, onOpenSidebar }) {
  const { jj, hh, mm, ss } = useCountdown()

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const pixelsByCountry = useMapStore(s => s.pixelsByCountry)
  const totalPixels = Object.values(pixelsByCountry).reduce((s, a) => s + (a?.length ?? 0), 0)

  // All countries with at least 1 pixel, sorted by count — updates on every purchase
  const ranking = useMemo(() => {
    return Object.entries(pixelsByCountry)
      .map(([iso, arr]) => ({ iso, count: arr?.length ?? 0, country: QUALIFIED.find(c => c.iso === iso) }))
      .filter(e => e.country && e.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [pixelsByCountry])

  const muted    = useMapStore(s => s.muted)
  const setMuted = useMapStore(s => s.setMuted)

  const isDark = theme === 'dark'
  const canOpen = !!lastHoveredCountry
  const hoveredVoix = canOpen ? (pixelsByCountry[lastHoveredCountry.iso] ?? []).length : 0

  const accent   = isDark ? '#E8C84A' : '#1a3080'
  const leftBg   = isDark
    ? 'linear-gradient(to right, rgba(5,8,15,0.90) 0%, rgba(5,8,15,0.62) 72%, transparent 100%)'
    : 'linear-gradient(to right, rgba(232,237,248,0.97) 0%, rgba(232,237,248,0.70) 72%, transparent 100%)'
  const topBg    = isDark ? 'rgba(5,8,15,0.55)' : 'rgba(232,237,248,0.75)'
  const bottomBg = isDark ? 'rgba(5,8,15,0.93)' : 'rgba(232,237,248,0.95)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }}>

      {/* ── Left panel: logo + full ranking (scrollable) ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: 264,
        background: leftBg,
        boxShadow: isDark ? 'none' : '4px 0 18px rgba(0,0,0,0.07)',
        display: 'flex', flexDirection: 'column',
        padding: '14px 18px 90px 20px',
        overflowY: 'auto',
        pointerEvents: 'auto',
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: BEBAS, fontSize: 20, color: accent,
          letterSpacing: 3, lineHeight: 1,
          marginBottom: 14, flexShrink: 0,
        }}>
          VOICES WORLD CUP
        </div>

        {/* Ranking — one row per country with at least 1 pixel */}
        {ranking.map(({ iso, count, country }, i) => {
          const color = i < 3 ? MEDAL_COLORS[i] : '#4a5060'
          return (
            <div key={iso} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              marginBottom: 5, flexShrink: 0,
            }}>
              {/* Medal or rank number */}
              <span style={{
                width: 18, textAlign: 'center', lineHeight: 1, flexShrink: 0,
                fontSize: i < 3 ? 11 : 9,
                fontFamily: MONO, color,
              }}>
                {i < 3 ? MEDAL_ICONS[i] : `${i + 1}.`}
              </span>
              {/* Flag */}
              <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>
                {country.flag}
              </span>
              {/* Country name */}
              <span style={{
                fontFamily: MONO, fontSize: 9, color,
                letterSpacing: 0.5, flex: 1,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {country.name}
              </span>
              {/* Pixel count */}
              <span style={{ fontFamily: BEBAS, fontSize: 13, color, letterSpacing: 1, flexShrink: 0 }}>
                {fmtVoix(count)}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Top gradient — backdrop for countdown ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: `linear-gradient(to bottom, ${topBg} 0%, transparent 100%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Countdown (centered) ── */}
      <div style={{
        position: 'absolute', top: 12, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {[['JJ', jj], ['HH', hh], ['MM', mm], ['SS', ss]].map(([l, v], i) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <span style={{
                  fontFamily: BEBAS, fontSize: 20,
                  color: isDark ? 'rgba(232,200,74,0.3)' : 'rgba(26,48,128,0.22)',
                  margin: '0 2px', paddingBottom: 6,
                }}>:</span>
              )}
              <div style={{ textAlign: 'center', minWidth: 26 }}>
                <div style={{ fontFamily: BEBAS, fontSize: 24, color: isDark ? '#ffffff' : '#0d1230', lineHeight: 1 }}>{v}</div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(13,18,48,0.5)', letterSpacing: 1 }}>{l}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top right: X VOIX + theme toggle ── */}
      <div style={{
        position: 'absolute', top: 12, right: 20,
        display: 'flex', alignItems: 'center', gap: 10,
        pointerEvents: 'auto',
      }}>
        <div style={{
          fontFamily: BEBAS, fontSize: 20,
          color: accent, letterSpacing: 2, lineHeight: 1,
        }}>
          {fmtVoix(totalPixels)} VOIX
        </div>
        <button
          onClick={() => setMuted(!muted)}
          title={muted ? 'Activer le son' : 'Couper le son'}
          style={{
            background: isDark ? 'none' : 'rgba(26,48,128,0.06)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(26,48,128,0.18)'}`,
            color: isDark ? 'rgba(255,255,255,0.5)' : '#1a3080',
            fontSize: 12, cursor: 'pointer',
            borderRadius: 2, padding: '3px 6px', lineHeight: 1,
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >{muted ? '🔇' : '🔊'}</button>
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={isDark ? 'Mode clair' : 'Mode sombre'}
          style={{
            background: isDark ? 'none' : 'rgba(26,48,128,0.06)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(26,48,128,0.18)'}`,
            color: isDark ? 'rgba(255,255,255,0.5)' : '#1a3080',
            fontSize: 12, cursor: 'pointer',
            borderRadius: 2, padding: '3px 6px', lineHeight: 1,
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >{isDark ? '☀️' : '🌙'}</button>
      </div>

      {/* ── Bottom: hexagonal CTA ── */}
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
              ? (isDark
                  ? 'linear-gradient(135deg, #E8C84A 0%, #c9a830 100%)'
                  : 'linear-gradient(135deg, #1a3080 0%, #2a45b0 100%)')
              : (isDark ? 'rgba(232,200,74,0.1)' : 'rgba(26,48,128,0.08)'),
            border: 'none',
            color: canOpen
              ? (isDark ? '#05080F' : '#ffffff')
              : (isDark ? 'rgba(232,200,74,0.28)' : 'rgba(26,48,128,0.28)'),
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

    </div>
  )
}
