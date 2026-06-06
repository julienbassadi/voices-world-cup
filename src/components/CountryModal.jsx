import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import useMapStore from '../store/mapStore'
import useAuthStore from '../store/authStore'
import { useMobile } from '../hooks/useMobile'

const BEBAS       = "'Bebas Neue', Impact, sans-serif"
const MONO        = "'DM Mono', monospace"
const GRID_SIZE   = 200
const CELL_SIZE   = 3
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE  // 600px

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const clampOffset = (offset, scale) => clamp(offset, CANVAS_SIZE * (1 - scale), 0)

export default function CountryModal({
  country,
  sidebarOpen,
  onClose,
  onBuy,
  onNeedAuth,
  onPixelDoubleClick,
  highlightPixel = null,
}) {
  const isMobile = useMobile()

  const canvasRef       = useRef(null)
  const clickTimerRef   = useRef(null)
  const lastClickRef    = useRef(null)
  const mouseDownRef    = useRef(null)
  const dragRef         = useRef(null)
  const closeTimerRef   = useRef(null)
  const touchHandlerRef = useRef({}) // stable refs for touch handlers

  const [hoveredCell, setHoveredCell] = useState(null)
  const [tooltip, setTooltip]         = useState(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [isClosing, setIsClosing]     = useState(false)
  const [pulsePhase, setPulsePhase]   = useState(0)
  const [isLight, setIsLight]         = useState(
    () => document.documentElement.getAttribute('data-theme') === 'light'
  )

  // ── Transform: { scale: 1..8, offsetX, offsetY } in canvas logical px ────
  const [transform, setTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0 })
  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 })

  const applyTransform = useCallback((t) => {
    transformRef.current = t
    setTransform(t)
  }, [])

  // ── Store ─────────────────────────────────────────────────────────────────
  const pixelsByCountry   = useMapStore(s => s.pixelsByCountry)
  const pendingGridPixels = useMapStore(s => s.pendingGridPixels)
  const isLoggedIn        = useAuthStore(s => s.isLoggedIn)

  const countryPixels = pixelsByCountry[country?.iso] ?? []
  const pixelCount    = countryPixels.length

  const pixelMap = useMemo(() => {
    const map = new Map()
    for (const px of countryPixels) {
      if (px.gridX != null && px.gridY != null)
        map.set(`${px.gridX}:${px.gridY}`, px)
    }
    return map
  }, [countryPixels])

  const pendingCount = useMemo(() => {
    const prefix = `${country?.iso}:`
    let n = 0
    for (const k of pendingGridPixels) { if (k.startsWith(prefix)) n++ }
    return n
  }, [pendingGridPixels, country?.iso])

  // ── Theme sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // ── Canvas draw ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !country) return
    const ctx = canvas.getContext('2d')
    const { scale, offsetX, offsetY } = transform

    ctx.fillStyle = '#0a0f1e'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Visible cell range (culling)
    const x0 = Math.max(0, Math.floor(-offsetX / scale / CELL_SIZE) - 1)
    const y0 = Math.max(0, Math.floor(-offsetY / scale / CELL_SIZE) - 1)
    const x1 = Math.min(GRID_SIZE - 1, Math.ceil((-offsetX + CANVAS_SIZE) / scale / CELL_SIZE))
    const y1 = Math.min(GRID_SIZE - 1, Math.ceil((-offsetY + CANVAS_SIZE) / scale / CELL_SIZE))

    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)

    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
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
            ctx.lineWidth   = 0.5 / scale
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

    ctx.restore()

    // Pulse ring over highlighted pixel
    if (highlightPixel && pulsePhase > 0) {
      const { gridX, gridY } = highlightPixel
      if (gridX >= x0 && gridX <= x1 && gridY >= y0 && gridY <= y1) {
        const { scale, offsetX, offsetY } = transform
        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(scale, scale)
        const hx = gridX * CELL_SIZE
        const hy = gridY * CELL_SIZE
        ctx.strokeStyle = '#E8C84A'
        ctx.lineWidth   = 2 / scale
        ctx.globalAlpha = pulsePhase
        ctx.shadowColor = '#E8C84A'
        ctx.shadowBlur  = 8 / scale
        ctx.strokeRect(hx - 1.5 / scale, hy - 1.5 / scale, CELL_SIZE + 3 / scale, CELL_SIZE + 3 / scale)
        ctx.shadowBlur  = 0
        ctx.globalAlpha = 1
        ctx.restore()
      }
    }
  }, [pixelMap, pendingGridPixels, hoveredCell, country, transform, highlightPixel, pulsePhase])

  // ── Wheel zoom (non-passive for preventDefault) ────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect   = canvas.getBoundingClientRect()
      const cX     = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width)
      const cY     = (e.clientY - rect.top)  * (CANVAS_SIZE / rect.height)
      const { scale, offsetX, offsetY } = transformRef.current
      const factor = e.deltaY < 0 ? 1.25 : 0.8
      const ns     = clamp(scale * factor, 1, 8)
      applyTransform({
        scale:   ns,
        offsetX: clampOffset(cX - (cX - offsetX) * (ns / scale), ns),
        offsetY: clampOffset(cY - (cY - offsetY) * (ns / scale), ns),
      })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [applyTransform])

  // ── Keep touch handler refs fresh ────────────────────────────────────────
  useEffect(() => {
    touchHandlerRef.current = { applyTransform, handleClick: null }
  })

  // ── Touch pinch-zoom + pan (non-passive for preventDefault) ───────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let touchData = null

    const onTouchStart = (e) => {
      e.preventDefault()
      if (e.touches.length === 1) {
        const t = e.touches[0]
        mouseDownRef.current = { clientX: t.clientX, clientY: t.clientY }
        if (transformRef.current.scale > 1) {
          dragRef.current = {
            startClientX: t.clientX, startClientY: t.clientY,
            startOffsetX: transformRef.current.offsetX,
            startOffsetY: transformRef.current.offsetY,
          }
          setIsDragging(true)
        }
        touchData = { type: 'single' }
      } else if (e.touches.length === 2) {
        dragRef.current = null
        mouseDownRef.current = null
        setIsDragging(false)
        const [t0, t1] = [e.touches[0], e.touches[1]]
        touchData = {
          type: 'pinch',
          startDist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
          startScale: transformRef.current.scale,
          startOffsetX: transformRef.current.offsetX,
          startOffsetY: transformRef.current.offsetY,
          cx: (t0.clientX + t1.clientX) / 2,
          cy: (t0.clientY + t1.clientY) / 2,
        }
      }
    }

    const onTouchMove = (e) => {
      e.preventDefault()
      if (!touchData) return
      if (e.touches.length === 1 && touchData.type === 'single' && dragRef.current) {
        const rect  = canvas.getBoundingClientRect()
        const ratio = CANVAS_SIZE / rect.width
        const { startClientX, startClientY, startOffsetX, startOffsetY } = dragRef.current
        const { scale } = transformRef.current
        touchHandlerRef.current.applyTransform?.({
          scale,
          offsetX: clampOffset(startOffsetX + (e.touches[0].clientX - startClientX) * ratio, scale),
          offsetY: clampOffset(startOffsetY + (e.touches[0].clientY - startClientY) * ratio, scale),
        })
      } else if (e.touches.length === 2 && touchData.type === 'pinch') {
        const [t0, t1] = [e.touches[0], e.touches[1]]
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const { startDist, startScale, startOffsetX, startOffsetY, cx, cy } = touchData
        const ns   = clamp(startScale * (dist / startDist), 1, 8)
        const rect = canvas.getBoundingClientRect()
        const ratio = CANVAS_SIZE / rect.width
        const cX = (cx - rect.left) * ratio
        const cY = (cy - rect.top) * ratio
        touchHandlerRef.current.applyTransform?.({
          scale: ns,
          offsetX: clampOffset(cX - (cX - startOffsetX) * (ns / startScale), ns),
          offsetY: clampOffset(cY - (cY - startOffsetY) * (ns / startScale), ns),
        })
      }
    }

    const onTouchEnd = (e) => {
      if (touchData?.type === 'single' && e.changedTouches.length === 1) {
        const t    = e.changedTouches[0]
        const down = mouseDownRef.current
        if (down && Math.abs(t.clientX - down.clientX) < 12 && Math.abs(t.clientY - down.clientY) < 12) {
          touchHandlerRef.current.handleClick?.({ clientX: t.clientX, clientY: t.clientY })
        }
      }
      touchData = null
      dragRef.current = null
      mouseDownRef.current = null
      setIsDragging(false)
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false })
    canvas.addEventListener('touchend',   onTouchEnd)
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove',  onTouchMove)
      canvas.removeEventListener('touchend',   onTouchEnd)
    }
  }, []) // stable — all values via refs

  // ── Coordinate helpers (only use refs — always stable) ────────────────────
  const toCanvasPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (CANVAS_SIZE / rect.width),
      y: (e.clientY - rect.top)  * (CANVAS_SIZE / rect.height),
    }
  }, [])

  const toCellCoords = useCallback((canvasX, canvasY) => {
    const { scale, offsetX, offsetY } = transformRef.current
    const gx = Math.floor((canvasX - offsetX) / scale / CELL_SIZE)
    const gy = Math.floor((canvasY - offsetY) / scale / CELL_SIZE)
    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return null
    return { gx, gy }
  }, [])

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    mouseDownRef.current = { clientX: e.clientX, clientY: e.clientY }
    if (transformRef.current.scale > 1) {
      dragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startOffsetX: transformRef.current.offsetX,
        startOffsetY: transformRef.current.offsetY,
      }
      setIsDragging(true)
    }
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (dragRef.current) {
      const rect  = canvasRef.current.getBoundingClientRect()
      const ratio = CANVAS_SIZE / rect.width
      const { startClientX, startClientY, startOffsetX, startOffsetY } = dragRef.current
      const { scale } = transformRef.current
      applyTransform({
        scale,
        offsetX: clampOffset(startOffsetX + (e.clientX - startClientX) * ratio, scale),
        offsetY: clampOffset(startOffsetY + (e.clientY - startClientY) * ratio, scale),
      })
      return
    }
    const { x, y } = toCanvasPos(e)
    const cell     = toCellCoords(x, y)
    setHoveredCell(cell)
    if (!cell) { setTooltip(null); return }
    const px        = pixelMap.get(`${cell.gx}:${cell.gy}`)
    const isPending = pendingGridPixels.has(`${country.iso}:${cell.gx}:${cell.gy}`)
    setTooltip({
      x: e.clientX + 14, y: e.clientY - 10,
      message: px
        ? 'ÉCOUTER — DOUBLE-CLIC POUR DÉTAILS'
        : isPending
          ? 'SÉLECTIONNÉ — CLIQUER POUR RETIRER'
          : 'PLACER MA VOIX',
    })
  }, [toCanvasPos, toCellCoords, pixelMap, pendingGridPixels, country?.iso, applyTransform])

  const endDrag = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    endDrag()
    setHoveredCell(null)
    setTooltip(null)
  }, [endDrag])

  // Keep handleClick ref fresh for touch handler
  const handleClickRef = useRef(null)

  const handleClick = useCallback((e) => {
    // Ignore if mouse moved significantly (was a drag)
    const down = mouseDownRef.current
    if (down && (Math.abs(e.clientX - down.clientX) > 4 || Math.abs(e.clientY - down.clientY) > 4)) return

    const { x, y } = toCanvasPos(e)
    const cell      = toCellCoords(x, y)
    if (!cell) return
    const { gx, gy } = cell
    const px = pixelMap.get(`${gx}:${gy}`)

    if (px) {
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
  }, [toCanvasPos, toCellCoords, pixelMap, country?.iso, onPixelDoubleClick])

  // Sync handleClick into ref for touch handler
  useEffect(() => {
    handleClickRef.current = handleClick
    touchHandlerRef.current.handleClick = handleClick
  }, [handleClick])

  // ── Pan + pulse on highlighted pixel (from "Mes Pixels" navigation) ─────
  useEffect(() => {
    if (!highlightPixel) { setPulsePhase(0); return }
    const { gridX, gridY } = highlightPixel
    // Center the target pixel in the canvas at scale 4
    const targetScale = 4
    const cx = gridX * CELL_SIZE + CELL_SIZE / 2
    const cy = gridY * CELL_SIZE + CELL_SIZE / 2
    applyTransform({
      scale:   targetScale,
      offsetX: clampOffset(CANVAS_SIZE / 2 - cx * targetScale, targetScale),
      offsetY: clampOffset(CANVAS_SIZE / 2 - cy * targetScale, targetScale),
    })
    // Pulse for ~2.4s (12 frames × 200ms)
    let frame = 0
    setPulsePhase(1)
    const id = setInterval(() => {
      frame++
      setPulsePhase(frame % 2 === 0 ? 1 : 0.35)
      if (frame >= 12) { clearInterval(id); setPulsePhase(0) }
    }, 200)
    return () => clearInterval(id)
  }, [highlightPixel, applyTransform])

  // ── Zoom buttons ──────────────────────────────────────────────────────────
  const zoomBy = useCallback((factor) => {
    const { scale, offsetX, offsetY } = transformRef.current
    const ns = clamp(scale * factor, 1, 8)
    const cx = CANVAS_SIZE / 2
    const cy = CANVAS_SIZE / 2
    applyTransform({
      scale:   ns,
      offsetX: clampOffset(cx - (cx - offsetX) * (ns / scale), ns),
      offsetY: clampOffset(cy - (cy - offsetY) * (ns / scale), ns),
    })
  }, [applyTransform])

  // ── Buy ───────────────────────────────────────────────────────────────────
  const handleBuyClick = useCallback(() => {
    if (pendingCount === 0) return
    if (!isLoggedIn) {
      onNeedAuth?.(() => onBuy?.(country))
      return
    }
    onBuy?.(country)
  }, [pendingCount, isLoggedIn, onNeedAuth, onBuy, country])

  // Triggers closing animation, then calls onClose after it completes
  const startClose = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => onClose?.(), 230)
  }, [isClosing, onClose])

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) startClose()
  }, [startClose])

  useEffect(() => () => {
    clearTimeout(clickTimerRef.current)
    clearTimeout(closeTimerRef.current)
  }, [])

  if (!country) return null

  const accent     = isLight ? '#1e3a8a' : '#E8C84A'
  const bg         = isLight ? '#ffffff' : '#0d1525'
  const mutedColor = isLight ? 'rgba(30,58,138,0.6)' : 'rgba(255,255,255,0.45)'
  const dividerClr = isLight ? 'rgba(30,58,138,0.12)' : 'rgba(232,200,74,0.12)'

  const canvasCursor = isDragging ? 'grabbing' : transform.scale > 1 ? 'grab' : 'crosshair'

  const zBtnBase = {
    width: 26, height: 26,
    background: isLight ? 'rgba(30,58,138,0.1)' : 'rgba(5,8,15,0.8)',
    border:     `1px solid ${accent}`,
    color:      accent,
    fontFamily: BEBAS, fontSize: 20, lineHeight: '24px',
    cursor:     'pointer', padding: 0,
    display:    'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none',
  }

  const scaleLabel = Number.isInteger(transform.scale)
    ? `×${transform.scale}`
    : `×${transform.scale.toFixed(1)}`

  return (
    <div
      onClick={isMobile ? undefined : handleBackdropClick}
      style={{
        position:      'fixed', inset: 0,
        background:    isMobile ? bg : 'rgba(0,0,0,0.75)',
        display:       'flex', alignItems: 'center', justifyContent: 'center',
        zIndex:        1000,
        paddingRight:  (!isMobile && sidebarOpen) ? 320 : 0,
        transition:    'padding-right 0.22s cubic-bezier(0.16,1,0.3,1)',
        animation:     isClosing ? 'fadeOut 0.22s ease forwards' : 'none',
        pointerEvents: isClosing ? 'none' : undefined,
      }}
    >
      <div style={{
        background:    bg,
        border:        isMobile ? 'none' : `2px solid ${accent}`,
        display:       'flex',
        flexDirection: 'column',
        height:        isMobile ? '100%' : 'min(90vh, 720px)',
        width:         isMobile ? '100%' : 660,
        maxWidth:      isMobile ? '100vw' : '95vw',
        animation:     isClosing
          ? 'slideOutDown 0.22s cubic-bezier(0.4,0,1,1) forwards'
          : 'slideInUp 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
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
          <button onClick={startClose} style={{
            background: 'none', border: 'none', color: mutedColor,
            fontSize: isMobile ? 22 : 20,
            cursor: 'pointer', padding: '4px 8px',
            lineHeight: 1, fontFamily: MONO, flexShrink: 0,
            minWidth: 44, minHeight: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{isMobile ? '←' : '✕'}</button>
        </div>

        {/* ── Grid area ── */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: '#0a0f1e' }}>

          {/* Canvas wrapper — maintains 1:1 aspect ratio, fills available space */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              position: 'relative',
              width:  '100%',
              height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                style={{
                  display:        'block',
                  maxWidth:       '100%',
                  maxHeight:      '100%',
                  aspectRatio:    '1 / 1',
                  cursor:         canvasCursor,
                  imageRendering: 'pixelated',
                  touchAction:    'none',
                }}
              />
            </div>
          </div>

          {/* Zoom controls */}
          <div style={{
            position: 'absolute', top: 10, right: 10, zIndex: 2,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          }}>
            <button onClick={() => zoomBy(1.5)} style={zBtnBase} title="Zoom avant">+</button>
            <div style={{
              fontFamily: MONO, fontSize: 9, color: accent,
              letterSpacing: 0.5, userSelect: 'none', textAlign: 'center',
              minWidth: 26,
            }}>
              {scaleLabel}
            </div>
            <button onClick={() => zoomBy(1 / 1.5)} style={zBtnBase} title="Zoom arrière">−</button>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
          borderTop: `1px solid ${dividerClr}`,
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
              padding:      isMobile ? '14px 20px' : '12px 20px',
              minHeight:    isMobile ? 52 : 'auto',
              background:   pendingCount === 0
                ? (isLight ? 'rgba(30,58,138,0.1)' : 'rgba(255,255,255,0.05)')
                : (isLight
                    ? 'linear-gradient(135deg,#1e3a8a,#2952c0)'
                    : 'linear-gradient(135deg,#E8C84A,#c9a830)'),
              border:       'none',
              color:        pendingCount === 0
                ? mutedColor
                : (isLight ? '#ffffff' : '#05080F'),
              fontFamily:   BEBAS, fontSize: 15, letterSpacing: 2,
              cursor:       pendingCount === 0 ? 'not-allowed' : 'pointer',
              borderRadius: 2, whiteSpace: 'nowrap',
              opacity:      pendingCount === 0 ? 0.5 : 1,
              transition:   'all 0.2s',
            }}
          >
            {pendingCount > 0
              ? `ACHETER ${pendingCount} PIXEL${pendingCount > 1 ? 'S' : ''} — ${pendingCount} €`
              : 'ACHETER'}
          </button>
        </div>
      </div>

      {/* Tooltip */}
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
