import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import useMapStore from '../store/mapStore'
import useAuthStore from '../store/authStore'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"
const GRID_SIZE = 200
const CELL_SIZE = 3

export default function CountryModal({ country, onClose, onBuy, onNeedAuth, onPixelDoubleClick }) {
  const canvasRef     = useRef(null)
  const clickTimerRef = useRef(null)
  const lastClickRef  = useRef(null)

  const [hoveredCell, setHoveredCell] = useState(null)
  const [tooltip, setTooltip]         = useState(null)
  const [isLight, setIsLight]         = useState(
    () => document.documentElement.getAttribute('data-theme') === 'light'
  )

  const pixelsByCountry   = useMapStore(s => s.pixelsByCountry)
  const pendingGridPixels = useMapStore(s => s.pendingGridPixels)
  const isLoggedIn        = useAuthStore(s => s.isLoggedIn)

  const countryPixels = pixelsByCountry[country?.iso] ?? []
  const pixelCount    = countryPixels.length

  // Map "gx:gy" → pixel for O(1) lookup
  const pixelMap = useMemo(() => {
    const map = new Map()
    for (const px of countryPixels) {
      if (px.gridX != null && px.gridY != null) {
        map.set(`${px.gridX}:${px.gridY}`, px)
      }
    }
    return map
  }, [countryPixels])

  const pendingCount = useMemo(() => {
    const prefix = `${country?.iso}:`
    let n = 0
    for (const key of pendingGridPixels) { if (key.startsWith(prefix)) n++ }
    return n
  }, [pendingGridPixels, country?.iso])

  // Theme sync
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // Canvas draw — runs whenever pixel state or hover changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !country) return
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#0a0f1e'
    ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE)

    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const px        = pixelMap.get(`${gx}:${gy}`)
        const isPending = pendingGridPixels.has(`${country.iso}:${gx}:${gy}`)
        const isHovered = hoveredCell?.gx === gx && hoveredCell?.gy === gy
        const cx = gx * CELL_SIZE
        const cy = gy * CELL_SIZE
        const sz = CELL_SIZE - 0.5

        ctx.globalAlpha = 1
        if (px) {
          ctx.fillStyle = px.color ?? '#E8C84A'
          ctx.fillRect(cx, cy, sz, sz)
          if (isHovered) {
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth   = 0.5
            ctx.globalAlpha = 0.8
            ctx.strokeRect(cx + 0.25, cy + 0.25, sz - 0.5, sz - 0.5)
            ctx.globalAlpha = 1
          }
        } else if (isPending) {
          ctx.fillStyle   = '#E8C84A'
          ctx.globalAlpha = isHovered ? 0.8 : 0.5
          ctx.fillRect(cx, cy, sz, sz)
          ctx.globalAlpha = 1
        } else {
          ctx.fillStyle = '#1a2a4a'
          ctx.fillRect(cx, cy, sz, sz)
          if (isHovered) {
            ctx.fillStyle   = '#E8C84A'
            ctx.globalAlpha = 0.3
            ctx.fillRect(cx, cy, sz, sz)
            ctx.globalAlpha = 1
          }
        }
      }
    }
  }, [pixelMap, pendingGridPixels, hoveredCell, country])

  // Compute which grid cell is under the mouse
  const getCellFromEvent = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect   = canvas.getBoundingClientRect()
    const scaleX = (GRID_SIZE * CELL_SIZE) / rect.width
    const scaleY = (GRID_SIZE * CELL_SIZE) / rect.height
    const gx = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE)
    const gy = Math.floor((e.clientY - rect.top)  * scaleY / CELL_SIZE)
    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return null
    return { gx, gy }
  }, [])

  const handleMouseMove = useCallback((e) => {
    const cell = getCellFromEvent(e)
    setHoveredCell(cell)
    if (!cell) { setTooltip(null); return }
    const px        = pixelMap.get(`${cell.gx}:${cell.gy}`)
    const isPending = pendingGridPixels.has(`${country.iso}:${cell.gx}:${cell.gy}`)
    const msg = px
      ? 'ÉCOUTER — DOUBLE-CLIC POUR DÉTAILS'
      : isPending
        ? 'SÉLECTIONNÉ — CLIQUER POUR RETIRER'
        : 'PLACER MA VOIX'
    setTooltip({ x: e.clientX + 14, y: e.clientY - 10, message: msg })
  }, [getCellFromEvent, pixelMap, pendingGridPixels, country?.iso])

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null)
    setTooltip(null)
  }, [])

  const handleClick = useCallback((e) => {
    const cell = getCellFromEvent(e)
    if (!cell) return
    const { gx, gy } = cell
    const px = pixelMap.get(`${gx}:${gy}`)

    if (px) {
      // Single click → play audio; double click → open VocalSpace
      const key = `${country.iso}:${gx}:${gy}`
      if (clickTimerRef.current && lastClickRef.current === key) {
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
        lastClickRef.current  = null
        onPixelDoubleClick?.({ iso: country.iso, pixel: px })
      } else {
        lastClickRef.current  = key
        clickTimerRef.current = setTimeout(() => {
          clickTimerRef.current = null
          lastClickRef.current  = null
          useMapStore.getState().setClickedPixel(country.iso, px.id)
        }, 240)
      }
    } else {
      useMapStore.getState().toggleGridPixel(country.iso, gx, gy)
    }
  }, [getCellFromEvent, pixelMap, country?.iso, onPixelDoubleClick])

  const handleBuyClick = useCallback(() => {
    if (pendingCount === 0) return
    if (!isLoggedIn) {
      onNeedAuth?.(() => onBuy?.(country))
      return
    }
    onBuy?.(country)
  }, [pendingCount, isLoggedIn, onNeedAuth, onBuy, country])

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose?.()
  }, [onClose])

  // Cleanup click timer on unmount
  useEffect(() => () => clearTimeout(clickTimerRef.current), [])

  if (!country) return null

  const accent     = isLight ? '#1a3080' : '#E8C84A'
  const bg         = isLight ? '#ffffff' : '#0d1525'
  const mutedColor = isLight ? 'rgba(26,48,128,0.6)' : 'rgba(255,255,255,0.45)'
  const dividerClr = isLight ? 'rgba(26,48,128,0.12)' : 'rgba(232,200,74,0.12)'

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{
        background:    bg,
        border:        `2px solid ${accent}`,
        display:       'flex',
        flexDirection: 'column',
        maxHeight:     '90vh',
        width:         660,
        maxWidth:      '95vw',
        animation:     'slideInUp 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Header */}
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        12,
          padding:    '14px 20px',
          borderBottom: `1px solid ${dividerClr}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 34, lineHeight: 1 }}>{country.flag}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: BEBAS, fontSize: 26, color: accent, letterSpacing: 2, lineHeight: 1 }}>
              {country.name}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: mutedColor, letterSpacing: 1, marginTop: 3 }}>
              {pixelCount.toLocaleString()} / 40 000 pixels occupés
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: mutedColor, fontSize: 20,
              cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
              fontFamily: MONO, flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Grid */}
        <div style={{ overflow: 'auto', flex: 1, padding: 12 }}>
          <canvas
            ref={canvasRef}
            width={GRID_SIZE * CELL_SIZE}
            height={GRID_SIZE * CELL_SIZE}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{
              display:         'block',
              cursor:          'crosshair',
              imageRendering:  'pixelated',
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        12,
          padding:    '14px 20px',
          borderTop:  `1px solid ${dividerClr}`,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {pendingCount > 0 ? (
              <div style={{ fontFamily: MONO, fontSize: 12, color: accent, letterSpacing: 0.5 }}>
                <span style={{ fontFamily: BEBAS, fontSize: 22 }}>{pendingCount}</span>
                {' '}pixel{pendingCount > 1 ? 's' : ''} sélectionné{pendingCount > 1 ? 's' : ''}{' '}
                = <strong>{pendingCount} €</strong>
              </div>
            ) : (
              <div style={{ fontFamily: MONO, fontSize: 10, color: mutedColor, letterSpacing: 0.5 }}>
                Cliquez sur les pixels gris pour les sélectionner
              </div>
            )}
          </div>
          <button
            onClick={handleBuyClick}
            disabled={pendingCount === 0}
            style={{
              padding:    '12px 20px',
              background: pendingCount === 0
                ? (isLight ? 'rgba(26,48,128,0.1)' : 'rgba(255,255,255,0.05)')
                : (isLight
                    ? 'linear-gradient(135deg,#1a3080,#2a45b0)'
                    : 'linear-gradient(135deg,#E8C84A,#c9a830)'),
              border:     'none',
              color:      pendingCount === 0
                ? mutedColor
                : (isLight ? '#ffffff' : '#05080F'),
              fontFamily: BEBAS,
              fontSize:   15,
              letterSpacing: 2,
              cursor:     pendingCount === 0 ? 'not-allowed' : 'pointer',
              borderRadius: 2,
              whiteSpace: 'nowrap',
              opacity:    pendingCount === 0 ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {pendingCount > 0
              ? `ACHETER ${pendingCount} PIXEL${pendingCount > 1 ? 'S' : ''} — ${pendingCount} €`
              : 'ACHETER'}
          </button>
        </div>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position:    'fixed',
          left:        tooltip.x,
          top:         tooltip.y,
          background:  'rgba(5,8,15,0.95)',
          border:      '1px solid #E8C84A',
          color:       '#E8C84A',
          fontSize:    12,
          fontFamily:  MONO,
          padding:     '4px 8px',
          pointerEvents: 'none',
          maxWidth:    260,
          zIndex:      1100,
        }}>
          {tooltip.message}
        </div>
      )}
    </div>
  )
}
