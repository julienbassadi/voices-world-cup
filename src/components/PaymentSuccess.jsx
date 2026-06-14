import { useState, useEffect, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { supabase } from '../lib/supabase'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"

function fireConfetti() {
  const burst = (ratio, opts) =>
    confetti({
      origin:        { x: 0.5, y: 0.5 },
      colors:        ['#E8C84A', '#FFFFFF', '#c9a830'],
      zIndex:        9999,
      particleCount: Math.floor(200 * ratio),
      ...opts,
    })
  burst(0.25, { spread: 26,  startVelocity: 55 })
  burst(0.2,  { spread: 60 })
  burst(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
  burst(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
  burst(0.1,  { spread: 120, startVelocity: 45 })
}

export default function PaymentSuccess({ onNavigateToPixel }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') !== 'success') return

    // Clean URL immediately so a refresh doesn't re-trigger the flow
    const clean = new URL(window.location)
    clean.searchParams.delete('payment')
    window.history.replaceState({}, '', clean)

    setVisible(true)
    fireConfetti()
  }, [])

  const handleClose = useCallback(async () => {
    setVisible(false)

    // Zoom to the last purchased pixel if we can resolve it
    const { data: { session } } = await supabase.auth.getSession()
    const authUserId = session?.user?.id
    if (!authUserId || !onNavigateToPixel) return

    const { data: pixel } = await supabase
      .from('pixels')
      .select('country_iso, grid_x, grid_y')
      .eq('user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pixel) {
      onNavigateToPixel({ iso: pixel.country_iso, gridX: pixel.grid_x, gridY: pixel.grid_y })
    }
  }, [onNavigateToPixel])

  if (!visible) return null

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         2000,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'rgba(0,0,0,0.75)',
    }}>
      <div style={{
        background:   '#0d1020',
        border:       '2px solid #E8C84A',
        borderRadius: 4,
        padding:      '44px 52px',
        maxWidth:     440,
        width:        '90vw',
        textAlign:    'center',
      }}>

        {/* Badge succès */}
        <div style={{
          display:      'inline-block',
          background:   'rgba(34,197,94,.12)',
          border:       '1px solid rgba(34,197,94,.35)',
          borderRadius: 2,
          padding:      '5px 14px',
          marginBottom: 24,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#22C55E', letterSpacing: 1 }}>
            ✓ Paiement confirmé
          </span>
        </div>

        {/* Titre */}
        <h1 style={{
          fontFamily:    BEBAS,
          fontSize:      34,
          color:         '#E8C84A',
          letterSpacing: 4,
          textTransform: 'uppercase',
          margin:        '0 0 14px',
          lineHeight:    1.1,
        }}>
          Votre voix est<br />sur la carte !
        </h1>

        <p style={{
          fontFamily:    MONO,
          fontSize:      12,
          color:         'rgba(255,255,255,0.45)',
          letterSpacing: 0.5,
          lineHeight:    1.8,
          margin:        '0 0 36px',
        }}>
          Votre participation à la Supporters World Cup 2026<br />
          a bien été enregistrée. Un email de confirmation<br />
          vous a été envoyé.
        </p>

        {/* CTA */}
        <button
          onClick={handleClose}
          style={{
            width:         '100%',
            padding:       '15px 0',
            background:    'linear-gradient(135deg,#E8C84A 0%,#c9a830 100%)',
            border:        'none',
            color:         '#05080F',
            fontFamily:    BEBAS,
            fontSize:      16,
            letterSpacing: 3,
            cursor:        'pointer',
            borderRadius:  2,
            textTransform: 'uppercase',
          }}
        >
          Voir ma voix
        </button>
      </div>
    </div>
  )
}
