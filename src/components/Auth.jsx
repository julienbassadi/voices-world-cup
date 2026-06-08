import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"

function useTheme() {
  const [isLight, setIsLight] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'light'
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return isLight
}

const mkInput = (isLight) => ({
  width: '100%',
  boxSizing: 'border-box',
  background: isLight ? '#f0f4ff' : 'rgba(255,255,255,0.05)',
  border: `1px solid ${isLight ? 'rgba(30,58,138,0.25)' : 'rgba(232,200,74,0.22)'}`,
  color: isLight ? '#0d1230' : '#e8e8e8',
  fontFamily: MONO,
  fontSize: 13,
  padding: '9px 12px',
  borderRadius: 2,
  outline: 'none',
  display: 'block',
  marginBottom: 14,
})

const mkPrimaryBtn = (isLight, disabled) => ({
  width: '100%',
  padding: '13px 0',
  background: disabled
    ? (isLight ? 'rgba(30,58,138,0.06)' : 'rgba(255,255,255,0.04)')
    : (isLight
        ? 'linear-gradient(135deg, #1e3a8a 0%, #2952c0 100%)'
        : 'linear-gradient(135deg, #E8C84A 0%, #c9a830 100%)'),
  border: disabled
    ? `1px solid ${isLight ? 'rgba(30,58,138,0.15)' : 'rgba(255,255,255,0.08)'}`
    : 'none',
  color: disabled
    ? (isLight ? 'rgba(30,58,138,0.35)' : 'rgba(255,255,255,0.2)')
    : (isLight ? '#ffffff' : '#05080F'),
  fontFamily: BEBAS,
  fontSize: 16,
  letterSpacing: 3,
  cursor: disabled ? 'not-allowed' : 'pointer',
  borderRadius: 2,
  transition: 'all 0.2s',
  marginTop: 4,
})

export default function Auth({ onClose }) {
  const [email, setEmail]       = useState('')
  const [linkSent, setLinkSent] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const sendMagicLink = useAuthStore(s => s.sendMagicLink)
  const isLight       = useTheme()

  const handleSubmit = async () => {
    if (!email.trim() || loading) return
    setError(null)
    setLoading(true)
    try {
      await sendMagicLink(email.trim())
      setLinkSent(true)
    } catch (err) {
      console.error('[Auth] sendMagicLink error:', err)
      setError("Impossible d'envoyer le lien. Vérifie l'adresse email.")
    } finally {
      setLoading(false)
    }
  }

  const accent     = isLight ? '#1e3a8a' : '#E8C84A'
  const bg         = isLight ? '#ffffff' : '#0D1320'
  const mutedColor = isLight ? 'rgba(30,58,138,0.55)' : 'rgba(232,200,74,0.48)'
  const shadow     = isLight ? '0 8px 48px rgba(0,0,0,0.18)' : '0 8px 48px rgba(0,0,0,0.65)'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg,
          border: `2px solid ${accent}`,
          borderRadius: 4,
          width: 370,
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: shadow,
          position: 'relative',
          padding: '32px 28px 28px',
        }}
      >
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 16,
          background: 'none', border: 'none',
          color: mutedColor, fontSize: 18,
          cursor: 'pointer', lineHeight: 1, padding: 4, fontFamily: MONO,
        }}>✕</button>

        <div style={{
          fontFamily: BEBAS, fontSize: 13, color: accent,
          letterSpacing: 3, marginBottom: 20, opacity: 0.7,
        }}>
          SUPPORTERS WORLD CUP 2026
        </div>

        {linkSent ? (
          <div style={{ textAlign: 'center', padding: '18px 0 10px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📩</div>
            <div style={{ fontFamily: BEBAS, color: accent, fontSize: 22, letterSpacing: 2, marginBottom: 8 }}>
              VÉRIFIE TA BOÎTE MAIL
            </div>
            <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 11, letterSpacing: 0.5, lineHeight: 1.7 }}>
              Un lien de connexion a été envoyé à
            </div>
            <div style={{ fontFamily: BEBAS, color: accent, fontSize: 15, letterSpacing: 1, marginTop: 6 }}>
              {email}
            </div>
            <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 10, marginTop: 16, letterSpacing: 0.5, lineHeight: 1.6 }}>
              Clique sur le lien dans l'email pour te connecter.
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: BEBAS, fontSize: 20, color: isLight ? '#0d1230' : '#e8e8e8', letterSpacing: 1, marginBottom: 6 }}>
              CONNEXION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: mutedColor, letterSpacing: 0.5, lineHeight: 1.6, marginBottom: 20 }}>
              Entre ton adresse email pour recevoir un lien de connexion instantané. Pas de mot de passe.
            </div>

            <Label text="EMAIL" color={mutedColor} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="ton@email.com"
              style={mkInput(isLight)}
              autoFocus
            />

            {error && (
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#EF4444', marginBottom: 10, letterSpacing: 0.5 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!email.trim() || loading}
              style={mkPrimaryBtn(isLight, !email.trim() || loading)}
            >
              {loading ? 'ENVOI...' : 'RECEVOIR MON LIEN DE CONNEXION'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Label({ text, color }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 10, color,
      letterSpacing: 1.5, marginBottom: 6,
    }}>
      {text}
    </div>
  )
}
