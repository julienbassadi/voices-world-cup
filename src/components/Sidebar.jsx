import { useState, useEffect, useRef } from 'react'
import useMapStore from '../store/mapStore'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"

export default function Sidebar({ country, onClose }) {
  const [pixelCount, setPixelCount] = useState('')
  const [recState, setRecState]     = useState('idle')
  const [timeLeft, setTimeLeft]     = useState(30)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [isLight, setIsLight]       = useState(
    () => document.documentElement.getAttribute('data-theme') === 'light'
  )
  const playTimerRef = useRef(null)
  const timerRef     = useRef(null)

  const pixelsByCountry = useMapStore(s => s.pixelsByCountry)
  const currentPixels   = (pixelsByCountry[country?.iso] ?? []).length

  // Mirror theme changes from HUD (observes the data-theme attribute on <html>)
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // Reset form when a different country opens the sidebar
  useEffect(() => {
    clearTimeout(playTimerRef.current)
    clearInterval(timerRef.current)
    setPixelCount('')
    setRecState('idle')
    setTimeLeft(30)
    setIsPlaying(false)
  }, [country?.iso])

  useEffect(() => () => {
    clearTimeout(playTimerRef.current)
    clearInterval(timerRef.current)
  }, [])

  // setInterval countdown — starts when recording, cleans up when state changes
  useEffect(() => {
    if (recState !== 'recording') return
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    timerRef.current = id
    return () => clearInterval(id)
  }, [recState])

  // Transition to review when countdown reaches 0
  useEffect(() => {
    if (recState === 'recording' && timeLeft === 0) setRecState('review')
  }, [recState, timeLeft])

  const handleRecord = () => {
    if (recState !== 'idle') return
    setTimeLeft(30)
    setRecState('recording')
  }

  const handleStop = () => {
    clearInterval(timerRef.current)
    setRecState('review')
  }

  const handleReplay = () => {
    if (isPlaying) return
    setIsPlaying(true)
    playTimerRef.current = setTimeout(() => setIsPlaying(false), 3000)
  }

  const handleRedo = () => {
    clearTimeout(playTimerRef.current)
    clearInterval(timerRef.current)
    setIsPlaying(false)
    setTimeLeft(30)
    setRecState('idle')
  }

  const handleValidate = () => setRecState('validated')
  const handleBack     = () => setRecState('review')

  const handleConfirm = () => {
    if (!canConfirm || !country) return
    useMapStore.getState().confirmPurchase(country.iso, numPixels, '🎙 Message vocal')
    onClose()
  }

  if (!country) return null

  const progressPct = (timeLeft / 30) * 100
  const numPixels   = parseInt(pixelCount) || 0
  const canConfirm  = recState === 'validated' && numPixels > 0

  // Theme-derived style tokens
  const accent     = isLight ? '#1a3080' : '#E8C84A'
  const sidebarBg  = isLight ? '#ffffff' : 'var(--bg-secondary)'
  const mutedColor = isLight ? 'rgba(26,48,128,0.6)' : 'var(--text-muted)'
  const dividerClr = isLight ? 'rgba(26,48,128,0.12)' : 'rgba(232,200,74,0.12)'
  const btnBg      = isLight ? '#1a3080' : 'rgba(255,255,255,0.04)'
  const btnBorder  = isLight ? '#1a3080' : 'rgba(255,255,255,0.1)'
  const btnColor   = isLight ? '#ffffff' : 'var(--text-muted)'
  const inputBg    = isLight ? '#f0f4ff' : 'var(--input-bg)'
  const shadow     = isLight ? '0 2px 12px rgba(0,0,0,0.15)' : 'none'

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 320,
      background: sidebarBg,
      borderLeft: `2px solid ${accent}`,
      boxShadow: shadow,
      zIndex: 300,
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
      overflowY: 'auto',
    }}>

      {/* Close */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 18,
        background: 'none', border: 'none',
        color: mutedColor, fontSize: 20,
        cursor: 'pointer', lineHeight: 1, padding: 6, fontFamily: MONO,
      }}>✕</button>

      {/* Country header */}
      <div style={{ padding: '36px 28px 20px' }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10 }}>{country.flag}</div>
        <div style={{ fontFamily: BEBAS, fontSize: 32, color: accent, letterSpacing: 2 }}>
          {country.name}
        </div>
        <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 11, marginTop: 4, letterSpacing: 1 }}>
          {currentPixels} voix déjà enregistrée{currentPixels !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ height: 1, background: dividerClr, margin: '0 28px' }} />

      {/* Pixel count */}
      <div style={{ padding: '18px 28px 0' }}>
        <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 11, letterSpacing: 1.5, marginBottom: 10 }}>
          NOMBRE DE PIXELS — 1€ / PIXEL
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            min={0}
            value={pixelCount}
            placeholder="?"
            onChange={e => setPixelCount(
              e.target.value === '' ? '' : String(Math.max(0, parseInt(e.target.value) || 0))
            )}
            style={{
              flex: 1,
              background: inputBg,
              border: `1px solid ${accent}`,
              color: accent,
              textAlign: 'center',
              fontFamily: BEBAS,
              fontSize: 52,
              padding: '8px 0',
              borderRadius: 2,
              outline: 'none',
              display: 'block',
              boxShadow: shadow,
            }}
          />
          {pixelCount !== '' && (
            <button
              onClick={() => setPixelCount('')}
              style={{
                background: 'none',
                border: `1px solid ${isLight ? 'rgba(26,48,128,0.3)' : 'rgba(255,255,255,0.15)'}`,
                color: mutedColor,
                fontSize: 16,
                cursor: 'pointer',
                borderRadius: 2,
                padding: '4px 10px',
                lineHeight: 1,
                fontFamily: MONO,
              }}
            >×</button>
          )}
        </div>
        <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
          = <span style={{ color: accent, fontWeight: 500 }}>{numPixels}€</span>
        </div>
      </div>

      <div style={{ height: 1, background: dividerClr, margin: '20px 28px' }} />

      {/* ── Recording section ── */}
      <div style={{ padding: '0 28px' }}>

        {/* IDLE */}
        {recState === 'idle' && (
          <button onClick={handleRecord} style={{
            width: '100%', padding: '13px 16px',
            background: btnBg,
            border: `1px solid ${btnBorder}`,
            color: btnColor,
            fontFamily: MONO, fontSize: 11, letterSpacing: 1.5,
            cursor: 'pointer', borderRadius: 2,
            boxShadow: shadow,
          }}>
            🎙 ENREGISTREMENT
          </button>
        )}

        {/* RECORDING */}
        {recState === 'recording' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: MONO, color: '#EF4444', fontSize: 11, letterSpacing: 1.5, animation: 'pulseRecord 1s infinite' }}>
                ⏺ ENREGISTREMENT
              </span>
              <span style={{ fontFamily: BEBAS, color: '#EF4444', fontSize: 26, lineHeight: 1 }}>
                {timeLeft}s
              </span>
            </div>
            <div style={{ height: 4, background: isLight ? 'rgba(26,48,128,0.12)' : 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #c9a830, #E8C84A)',
                borderRadius: 2,
                transition: 'width 0.8s linear',
              }} />
            </div>
            <button onClick={handleStop} style={{
              width: '100%', padding: '10px 0',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#EF4444',
              fontFamily: MONO, fontSize: 11, letterSpacing: 1.5,
              cursor: 'pointer', borderRadius: 2, marginBottom: 8,
            }}>
              ■ STOP
            </button>
            <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 10, textAlign: 'center', letterSpacing: 1 }}>
              Parlez maintenant — s'arrête automatiquement à 0
            </div>
          </div>
        )}

        {/* REVIEW */}
        {recState === 'review' && (
          <div>
            <div style={{ fontFamily: MONO, color: '#22C55E', fontSize: 11, letterSpacing: 1, marginBottom: 14 }}>
              ✓ Enregistrement terminé
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={handleReplay} style={{
                flex: 1, padding: '10px 0',
                background: isPlaying ? 'rgba(34,197,94,0.1)' : btnBg,
                border: `1px solid ${isPlaying ? 'rgba(34,197,94,0.4)' : btnBorder}`,
                color: isPlaying ? '#22C55E' : btnColor,
                fontFamily: MONO, fontSize: 10, letterSpacing: 1,
                cursor: isPlaying ? 'default' : 'pointer', borderRadius: 2,
                animation: isPlaying ? 'playPulse 0.8s ease-in-out infinite' : 'none',
                boxShadow: shadow,
              }}>
                {isPlaying ? '▶ ÉCOUTE...' : '▶ RÉÉCOUTER'}
              </button>
              <button onClick={handleRedo} style={{
                flex: 1, padding: '10px 0',
                background: btnBg,
                border: `1px solid ${btnBorder}`,
                color: btnColor,
                fontFamily: MONO, fontSize: 10, letterSpacing: 1,
                cursor: 'pointer', borderRadius: 2,
                boxShadow: shadow,
              }}>
                ↺ RECOMMENCER
              </button>
            </div>
            <button onClick={handleValidate} style={{
              width: '100%', padding: '12px 0',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.4)',
              color: '#22C55E',
              fontFamily: MONO, fontSize: 11, letterSpacing: 1.5,
              cursor: 'pointer', borderRadius: 2,
              boxShadow: shadow,
            }}>
              ✓ VALIDER
            </button>
          </div>
        )}

        {/* VALIDATED */}
        {recState === 'validated' && (
          <div>
            <div style={{
              padding: '12px 0', textAlign: 'center', marginBottom: 10,
              fontFamily: MONO, color: '#22C55E', fontSize: 11, letterSpacing: 1,
              border: '1px solid rgba(34,197,94,0.3)', borderRadius: 2,
            }}>
              ✓ ENREGISTREMENT VALIDÉ
            </div>
            <button onClick={handleBack} style={{
              width: '100%', padding: '10px 0',
              background: btnBg,
              border: `1px solid ${btnBorder}`,
              color: btnColor,
              fontFamily: MONO, fontSize: 10, letterSpacing: 1.5,
              cursor: 'pointer', borderRadius: 2,
              boxShadow: shadow,
            }}>
              ← RETOUR
            </button>
          </div>
        )}
      </div>

      {/* ── Confirm — pinned to bottom ── */}
      <div style={{ marginTop: 'auto', padding: '20px 28px 32px' }}>
        {!canConfirm && (
          <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 10, letterSpacing: 1, textAlign: 'center', marginBottom: 10, opacity: 0.7 }}>
            {recState === 'idle'
              ? 'Enregistrez un message pour continuer'
              : recState === 'recording'
              ? 'Enregistrement en cours...'
              : recState === 'validated' && numPixels === 0
              ? 'Entrez un nombre de pixels'
              : 'Validez votre message pour continuer'}
          </div>
        )}
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          style={{
            width: '100%', padding: '15px 20px',
            background: canConfirm
              ? (isLight
                  ? 'linear-gradient(135deg, #1a3080 0%, #2a45b0 100%)'
                  : 'linear-gradient(135deg, #E8C84A 0%, #c9a830 100%)')
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${canConfirm ? accent : 'rgba(255,255,255,0.07)'}`,
            color: canConfirm ? (isLight ? '#ffffff' : '#05080F') : mutedColor,
            fontFamily: BEBAS, fontSize: 18, letterSpacing: 3,
            cursor: canConfirm ? 'pointer' : 'not-allowed',
            borderRadius: 2,
            transition: 'all 0.25s',
            boxShadow: canConfirm ? shadow : 'none',
          }}
        >
          CONFIRMER L'ACHAT
        </button>
      </div>
    </div>
  )
}
