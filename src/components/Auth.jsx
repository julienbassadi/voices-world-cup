import { useState, useEffect, useRef } from 'react'
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

// ── Shared style helpers ──────────────────────────────────────────────────────
const mkInput = (isLight) => ({
  width: '100%',
  boxSizing: 'border-box',
  background: isLight ? '#f0f4ff' : 'rgba(255,255,255,0.05)',
  border: `1px solid ${isLight ? 'rgba(26,48,128,0.25)' : 'rgba(232,200,74,0.22)'}`,
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
    ? (isLight ? 'rgba(26,48,128,0.06)' : 'rgba(255,255,255,0.04)')
    : (isLight
        ? 'linear-gradient(135deg, #1a3080 0%, #2a45b0 100%)'
        : 'linear-gradient(135deg, #E8C84A 0%, #c9a830 100%)'),
  border: disabled
    ? `1px solid ${isLight ? 'rgba(26,48,128,0.15)' : 'rgba(255,255,255,0.08)'}`
    : 'none',
  color: disabled
    ? (isLight ? 'rgba(26,48,128,0.35)' : 'rgba(255,255,255,0.2)')
    : (isLight ? '#ffffff' : '#05080F'),
  fontFamily: BEBAS,
  fontSize: 16,
  letterSpacing: 3,
  cursor: disabled ? 'not-allowed' : 'pointer',
  borderRadius: 2,
  transition: 'all 0.2s',
  marginTop: 4,
})

// ── Component ─────────────────────────────────────────────────────────────────
export default function Auth({ onClose, onSuccess, initialTab = 'login' }) {
  const [tab, setTab]             = useState(initialTab)
  const [email, setEmail]         = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [linkSent, setLinkSent]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const loginTimerRef             = useRef(null)

  const login         = useAuthStore(s => s.login)
  const createAccount = useAuthStore(s => s.createAccount)
  const isLight       = useTheme()

  // Clean up auto-login timer if modal closes before it fires
  useEffect(() => () => clearTimeout(loginTimerRef.current), [])

  const switchTab = (t) => { setTab(t); setLinkSent(false); setError(null) }

  // ── Connexion — magic link simulation ──────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim()) return
    setError(null)
    setLinkSent(true)
    try {
      await login(email.trim())
      await new Promise(r => (loginTimerRef.current = setTimeout(r, 2200)))
      onSuccess()
    } catch {
      setLinkSent(false)
      setError('Email non reconnu. Créez un compte d\'abord.')
    }
  }

  // ── Inscription ────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return
    setError(null)
    setLoading(true)
    try {
      await createAccount(email.trim(), firstName.trim(), lastName.trim(), isAnonymous)
      onSuccess()
    } catch (err) {
      const msg = err?.message ?? ''
      const hint = err?.hint ? ` (${err.hint})` : ''
      if (msg.includes('duplicate') || msg.includes('unique') || err?.code === '23505') {
        setError('Cet email est déjà utilisé.')
      } else {
        setError(`Erreur : ${msg}${hint}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const accent      = isLight ? '#1a3080' : '#E8C84A'
  const bg          = isLight ? '#ffffff' : '#0D1320'
  const mutedColor  = isLight ? 'rgba(26,48,128,0.55)' : 'rgba(232,200,74,0.48)'
  const divider     = isLight ? 'rgba(26,48,128,0.14)' : 'rgba(232,200,74,0.16)'
  const checkBorder = isLight ? 'rgba(26,48,128,0.3)' : 'rgba(232,200,74,0.35)'
  const shadow      = isLight ? '0 8px 48px rgba(0,0,0,0.18)' : '0 8px 48px rgba(0,0,0,0.65)'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Modal card — stop click from bubbling to backdrop */}
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
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 16,
          background: 'none', border: 'none',
          color: mutedColor, fontSize: 18,
          cursor: 'pointer', lineHeight: 1, padding: 4, fontFamily: MONO,
        }}>✕</button>

        {/* Logo micro */}
        <div style={{
          fontFamily: BEBAS, fontSize: 13, color: accent,
          letterSpacing: 3, marginBottom: 20, opacity: 0.7,
        }}>
          VOICES WORLD CUP
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${divider}`, marginBottom: 24 }}>
          {[['login', 'CONNEXION'], ['register', 'CRÉER UN COMPTE']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${tab === key ? accent : 'transparent'}`,
                color: tab === key ? accent : mutedColor,
                fontFamily: BEBAS,
                fontSize: 13,
                letterSpacing: 2,
                padding: '0 0 10px',
                cursor: 'pointer',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── CONNEXION ──────────────────────────────────────────────────── */}
        {tab === 'login' && (
          linkSent ? (
            <div style={{ textAlign: 'center', padding: '18px 0 10px' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>✉️</div>
              <div style={{ fontFamily: MONO, color: '#22C55E', fontSize: 12, letterSpacing: 0.5, lineHeight: 1.7 }}>
                Un lien de connexion a été envoyé à
              </div>
              <div style={{ fontFamily: BEBAS, color: accent, fontSize: 16, letterSpacing: 1, marginTop: 4 }}>
                {email}
              </div>
              <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 10, marginTop: 14, letterSpacing: 1 }}>
                Connexion automatique en cours…
              </div>
            </div>
          ) : (
            <>
              <Label text="EMAIL" color={mutedColor} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
                onClick={handleLogin}
                disabled={!email.trim()}
                style={mkPrimaryBtn(isLight, !email.trim())}
              >
                CONNEXION
              </button>
            </>
          )
        )}

        {/* ── CRÉER UN COMPTE ────────────────────────────────────────────── */}
        {tab === 'register' && (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Label text="PRÉNOM" color={mutedColor} />
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Prénom"
                  style={mkInput(isLight)}
                  autoFocus
                />
              </div>
              <div style={{ flex: 1 }}>
                <Label text="NOM" color={mutedColor} />
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Nom"
                  style={mkInput(isLight)}
                />
              </div>
            </div>

            <Label text="EMAIL" color={mutedColor} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              placeholder="ton@email.com"
              style={mkInput(isLight)}
            />

            {/* Masquer mon identité */}
            <div
              onClick={() => setIsAnonymous(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', margin: '2px 0 20px',
              }}
            >
              <div style={{
                width: 16, height: 16, flexShrink: 0,
                border: `1.5px solid ${isAnonymous ? accent : checkBorder}`,
                background: isAnonymous ? accent : 'transparent',
                borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {isAnonymous && (
                  <span style={{ color: isLight ? '#ffffff' : '#05080F', fontSize: 10, lineHeight: 1, fontWeight: 700 }}>✓</span>
                )}
              </div>
              <span style={{ fontFamily: MONO, fontSize: 10, color: mutedColor, letterSpacing: 1 }}>
                MASQUER MON IDENTITÉ
              </span>
            </div>

            {error && (
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#EF4444', marginBottom: 10, letterSpacing: 0.5 }}>
                {error}
              </div>
            )}
            <button
              onClick={handleRegister}
              disabled={loading || !firstName.trim() || !lastName.trim() || !email.trim()}
              style={mkPrimaryBtn(isLight, loading || !firstName.trim() || !lastName.trim() || !email.trim())}
            >
              {loading ? 'CRÉATION...' : 'CRÉER MON COMPTE'}
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
