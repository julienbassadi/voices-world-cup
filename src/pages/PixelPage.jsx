import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { QUALIFIED } from '../components/WorldMap'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PixelPage({ pixelId }) {
  const [pixel, setPixel]       = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('pixels')
        .select('id, country_iso, color, pseudo, description, audio_url, likes, created_at')
        .eq('id', pixelId)
        .single(),
      supabase
        .from('comments')
        .select('id, content, created_at')
        .eq('pixel_id', pixelId)
        .order('created_at', { ascending: true }),
    ]).then(([pRes, cRes]) => {
      if (pRes.error || !pRes.data) { setNotFound(true); setLoading(false); return }
      setPixel(pRes.data)
      setComments(cRes.data ?? [])
      setLoading(false)
    })
  }, [pixelId])

  const country = pixel ? QUALIFIED.find(c => c.iso === pixel.country_iso) : null

  if (loading) {
    return (
      <div style={{ background: '#05080F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: BEBAS, color: '#E8C84A', fontSize: 18, letterSpacing: 3 }}>CHARGEMENT…</div>
      </div>
    )
  }

  if (notFound || !pixel) {
    return (
      <div style={{ background: '#05080F', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ fontFamily: BEBAS, color: '#E8C84A', fontSize: 22, letterSpacing: 3 }}>PIXEL INTROUVABLE</div>
        <a href="/" style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(232,200,74,0.6)', letterSpacing: 1 }}>← Retour à la carte</a>
      </div>
    )
  }

  return (
    <div style={{
      background: '#05080F',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '36px 20px 60px',
      fontFamily: MONO,
    }}>

      {/* Logo */}
      <a href="/" style={{
        fontFamily: BEBAS, fontSize: 18, color: '#E8C84A',
        letterSpacing: 3, textDecoration: 'none', marginBottom: 32,
      }}>
        VOICES WORLD CUP
      </a>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#0D1320',
        border: '2px solid #E8C84A',
        overflow: 'hidden',
      }}>

        {/* Country header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 24px',
          borderBottom: '1px solid rgba(232,200,74,0.12)',
          background: 'rgba(232,200,74,0.04)',
        }}>
          <div style={{
            width: 20, height: 20, flexShrink: 0,
            background: pixel.color ?? '#E8C84A',
            borderRadius: 2, border: '1px solid rgba(255,255,255,0.12)',
          }} />
          <span style={{ fontSize: 40, lineHeight: 1 }}>{country?.flag ?? '🏳️'}</span>
          <div>
            <div style={{ fontFamily: BEBAS, fontSize: 28, color: '#E8C84A', letterSpacing: 2, lineHeight: 1 }}>
              {country?.name ?? pixel.country_iso.toUpperCase()}
            </div>
            {pixel.pseudo && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 5, letterSpacing: 0.5 }}>
                {pixel.pseudo}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* Description */}
          {pixel.description && (
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.7, marginBottom: 20,
              letterSpacing: 0.3,
            }}>
              {pixel.description}
            </div>
          )}

          {/* Audio player */}
          {pixel.audio_url && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: BEBAS, fontSize: 13, color: '#E8C84A', letterSpacing: 1.5, marginBottom: 8 }}>
                ÉCOUTER LA VOIX
              </div>
              <audio
                controls
                src={pixel.audio_url}
                style={{ width: '100%', height: 36, accentColor: '#E8C84A' }}
              />
            </div>
          )}

          {/* Stats */}
          <div style={{
            display: 'flex', gap: 16,
            marginBottom: 20,
            fontSize: 12, color: 'rgba(255,255,255,0.4)',
          }}>
            <span>♥ <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{pixel.likes ?? 0}</strong> j'aime</span>
            <span>💬 <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{comments.length}</strong> commentaire{comments.length !== 1 ? 's' : ''}</span>
            {pixel.created_at && (
              <span style={{ marginLeft: 'auto', fontSize: 10 }}>{fmtDate(pixel.created_at)}</span>
            )}
          </div>

          {/* Comments */}
          {comments.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: BEBAS, fontSize: 13, color: '#E8C84A', letterSpacing: 1.5, marginBottom: 10 }}>
                COMMENTAIRES ({comments.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {comments.map(c => (
                  <div key={c.id} style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.6)',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(232,200,74,0.07)',
                    lineHeight: 1.6,
                    display: 'flex', gap: 8,
                  }}>
                    <span style={{ flex: 1 }}>{c.content}</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, flexShrink: 0 }}>
                      {fmtDate(c.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <a
            href="/"
            style={{
              display: 'block',
              padding: '14px 0',
              background: 'linear-gradient(135deg, #E8C84A, #c9a830)',
              color: '#05080F',
              fontFamily: BEBAS, fontSize: 16, letterSpacing: 3,
              textAlign: 'center', textDecoration: 'none',
              borderRadius: 2,
            }}
          >
            PLACER MA VOIX — 1€ / PIXEL
          </a>
        </div>
      </div>

      {/* Back link */}
      <a href="/" style={{
        marginTop: 24,
        fontFamily: MONO, fontSize: 10, color: 'rgba(232,200,74,0.45)',
        letterSpacing: 1, textDecoration: 'none',
      }}>
        ← RETOUR À LA CARTE
      </a>
    </div>
  )
}
