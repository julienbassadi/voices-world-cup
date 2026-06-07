import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { QUALIFIED } from '../components/WorldMap'

// ── Change this password before deploying ────────────────────────────────────
const ADMIN_PASSWORD = 'VWC2026ADMIN'
const SESSION_KEY    = 'vwc_admin_auth'

const BEBAS   = "'Bebas Neue', Impact, sans-serif"
const MONO    = "'DM Mono', monospace"
const BG      = '#05080F'
const BG2     = '#0D1320'
const ACCENT  = '#E8C84A'
const TEXT    = '#F0F0F0'
const MUTED   = 'rgba(255,255,255,0.45)'
const DIVIDER = 'rgba(232,200,74,0.10)'
const CARD    = 'rgba(13,19,32,0.98)'
const DANGER  = '#EF4444'

const fmtDate = iso => iso
  ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'
const fmtShort = iso => iso
  ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  : '—'

function extractStoragePath(url) {
  if (!url) return null
  const marker = '/storage/v1/object/public/audio/'
  const i = url.indexOf(marker)
  return i >= 0 ? url.slice(i + marker.length) : null
}

// ── SVG bar chart (last 30 days) ──────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(1, ...data.map(d => d.count))
  const W = 620, H = 140, pL = 34, pR = 8, pT = 16, pB = 28
  const iW = W - pL - pR
  const iH = H - pT - pB
  const bw = iW / data.length - 1.5

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 380, width: '100%', height: 'auto' }}>
        {[0.25, 0.5, 0.75, 1].map(r => (
          <line key={r}
            x1={pL} y1={pT + iH * (1 - r)} x2={W - pR} y2={pT + iH * (1 - r)}
            stroke={DIVIDER} strokeWidth={0.5} strokeDasharray="2 2"
          />
        ))}
        {data.map((d, i) => {
          const h  = Math.max(1, (d.count / max) * iH)
          const x  = pL + i * (iW / data.length) + 0.75
          const y  = pT + iH - h
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={bw} height={h}
                fill={d.count > 0 ? 'rgba(232,200,74,0.72)' : 'rgba(232,200,74,0.10)'} rx={1} />
              {d.count > 0 && (
                <text x={x + bw / 2} y={y - 3} textAnchor="middle"
                  fill={ACCENT} fontSize={7} fontFamily={MONO} opacity={0.8}>{d.count}</text>
              )}
            </g>
          )
        })}
        {data.map((d, i) => {
          if (i % 5 !== 0 && i !== data.length - 1) return null
          const x = pL + i * (iW / data.length) + bw / 2 + 0.75
          return (
            <text key={d.date} x={x} y={H - 5} textAnchor="middle"
              fill={MUTED} fontSize={7} fontFamily={MONO}>{d.date.slice(5)}</text>
          )
        })}
        <line x1={pL - 2} y1={pT} x2={pL - 2} y2={pT + iH + 1} stroke="rgba(232,200,74,0.20)" strokeWidth={1} />
        <text x={pL - 5} y={pT + 4}      textAnchor="end" fill={MUTED} fontSize={7} fontFamily={MONO}>{max}</text>
        <text x={pL - 5} y={pT + iH + 1} textAnchor="end" fill={MUTED} fontSize={7} fontFamily={MONO}>0</text>
      </svg>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${DIVIDER}`,
      padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: 2 }}>{label}</div>
      <div style={{ fontFamily: BEBAS, fontSize: 32, color: ACCENT, lineHeight: 1, letterSpacing: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>{sub}</div>}
    </div>
  )
}

// ── Inline audio player ───────────────────────────────────────────────────────
function AudioBtn({ url }) {
  const [playing, setPlaying] = useState(false)
  const ref = useRef(null)
  if (!url) return <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>—</span>
  const toggle = () => {
    if (!ref.current) {
      const a = new Audio(url)
      ref.current = a
      a.onended = () => { ref.current = null; setPlaying(false) }
      a.play().catch(() => {})
      setPlaying(true)
    } else {
      ref.current.pause()
      ref.current = null
      setPlaying(false)
    }
  }
  return (
    <button onClick={toggle} style={{
      background: playing ? 'rgba(34,197,94,0.1)' : 'rgba(232,200,74,0.08)',
      border: `1px solid ${playing ? 'rgba(34,197,94,0.40)' : 'rgba(232,200,74,0.25)'}`,
      color: playing ? '#22C55E' : ACCENT,
      fontSize: 10, padding: '3px 8px', cursor: 'pointer',
      fontFamily: MONO, borderRadius: 2, whiteSpace: 'nowrap',
    }}>
      {playing ? '⏸ STOP' : '▶ ÉCOUTER'}
    </button>
  )
}

// ── Confirm-before-delete button ──────────────────────────────────────────────
function DeleteBtn({ onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading]       = useState(false)
  if (confirming) return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <button
        onClick={async () => { setLoading(true); await onDelete(); setLoading(false) }}
        disabled={loading}
        style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.45)',
          color: DANGER, fontSize: 10, padding: '3px 8px',
          cursor: loading ? 'wait' : 'pointer', fontFamily: MONO, borderRadius: 2,
        }}
      >{loading ? '…' : '✓ OUI'}</button>
      <button
        onClick={() => setConfirming(false)}
        style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.12)',
          color: MUTED, fontSize: 10, padding: '3px 8px',
          cursor: 'pointer', fontFamily: MONO, borderRadius: 2,
        }}
      >NON</button>
    </span>
  )
  return (
    <button
      onClick={() => setConfirming(true)}
      style={{
        background: 'none', border: '1px solid rgba(239,68,68,0.22)',
        color: 'rgba(239,68,68,0.6)', fontSize: 10, padding: '3px 8px',
        cursor: 'pointer', fontFamily: MONO, borderRadius: 2, whiteSpace: 'nowrap',
      }}
    >🗑</button>
  )
}

// ── Search input ──────────────────────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: BG2, border: '1px solid rgba(255,255,255,0.12)',
        color: TEXT, fontFamily: MONO, fontSize: 11,
        padding: '7px 12px', outline: 'none', borderRadius: 2, width: 240,
      }}
    />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  const [pwd, setPwd]       = useState('')
  const [pwdErr, setPwdErr] = useState(false)

  const [tab, setTab]       = useState('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  const [stats, setStats]           = useState(null)
  const [dailyPixels, setDailyPixels] = useState([])
  const [pixels, setPixels]         = useState([])
  const [comments, setComments]     = useState([])
  const [users, setUsers]           = useState([])

  const [voiceSearch, setVoiceSearch]     = useState('')
  const [commentSearch, setCommentSearch] = useState('')

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleLogin = () => {
    if (pwd === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setAuthed(true)
    } else {
      setPwdErr(true)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(false)
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString()
      const [
        pixelsRes,
        pixelCountRes,
        recCountRes,
        commentCountRes,
        userCountRes,
        commentsRes,
        usersRes,
        recentRes,
      ] = await Promise.all([
        supabase.from('pixels')
          .select('id, country_iso, pseudo, description, audio_url, likes, created_at, color, user_id')
          .order('created_at', { ascending: false }),
        supabase.from('pixels').select('id', { count: 'exact', head: true }),
        supabase.from('pixels').select('id', { count: 'exact', head: true }).not('audio_url', 'is', null),
        supabase.from('comments').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('comments')
          .select('id, content, created_at, pixel_id')
          .order('created_at', { ascending: false }),
        supabase.from('users')
          .select('id, email, first_name, last_name, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('pixels').select('created_at').gte('created_at', thirtyAgo),
      ])

      if (pixelsRes.error) throw pixelsRes.error

      setPixels(pixelsRes.data ?? [])
      setComments(commentsRes.data ?? [])
      setUsers(usersRes.data ?? [])
      setStats({
        totalPixels:     pixelCountRes.count  ?? 0,
        totalRecordings: recCountRes.count    ?? 0,
        totalComments:   commentCountRes.count ?? 0,
        totalUsers:      userCountRes.count   ?? 0,
      })

      // Build 30-day chart data
      const days = {}
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - (29 - i) * 86400000)
        days[d.toISOString().slice(0, 10)] = 0
      }
      for (const p of (recentRes.data ?? [])) {
        const day = p.created_at?.slice(0, 10)
        if (day && days[day] !== undefined) days[day]++
      }
      setDailyPixels(Object.entries(days).map(([date, count]) => ({ date, count })))
    } catch (e) {
      console.error('Admin load error:', e)
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (authed) loadAll() }, [authed, loadAll])

  // ── Delete handlers ───────────────────────────────────────────────────────
  const handleDeletePixel = useCallback(async (pixel) => {
    if (pixel.audio_url) {
      const path = extractStoragePath(pixel.audio_url)
      if (path) await supabase.storage.from('audio').remove([path])
    }
    await supabase.from('comments').delete().eq('pixel_id', pixel.id)
    const { error } = await supabase.from('pixels').delete().eq('id', pixel.id)
    if (error) throw new Error(error.message)
    setPixels(prev => prev.filter(p => p.id !== pixel.id))
    setStats(prev => prev ? { ...prev, totalPixels: prev.totalPixels - 1 } : prev)
  }, [])

  const handleDeleteComment = useCallback(async (comment) => {
    const { error } = await supabase.from('comments').delete().eq('id', comment.id)
    if (error) throw new Error(error.message)
    setComments(prev => prev.filter(c => c.id !== comment.id))
    setStats(prev => prev ? { ...prev, totalComments: prev.totalComments - 1 } : prev)
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const pixelCountByCountry = useMemo(() => {
    const m = {}
    for (const p of pixels) m[p.country_iso] = (m[p.country_iso] ?? 0) + 1
    return m
  }, [pixels])

  const pixelCountByUser = useMemo(() => {
    const m = {}
    for (const p of pixels) m[p.user_id] = (m[p.user_id] ?? 0) + 1
    return m
  }, [pixels])

  const countryRanking = useMemo(() =>
    QUALIFIED
      .map(c => ({ ...c, count: pixelCountByCountry[c.iso] ?? 0 }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count),
    [pixelCountByCountry]
  )

  const filteredPixels = useMemo(() => {
    if (!voiceSearch) return pixels
    const q = voiceSearch.toLowerCase()
    return pixels.filter(p =>
      (p.pseudo ?? '').toLowerCase().includes(q) ||
      p.country_iso.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q)
    )
  }, [pixels, voiceSearch])

  const filteredComments = useMemo(() => {
    if (!commentSearch) return comments
    const q = commentSearch.toLowerCase()
    return comments.filter(c => c.content.toLowerCase().includes(q))
  }, [comments, commentSearch])

  // ── Shared table styles ───────────────────────────────────────────────────
  const th = {
    fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: 2,
    padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${DIVIDER}`,
    whiteSpace: 'nowrap', position: 'sticky', top: 0, background: BG2,
  }
  const td = {
    fontFamily: MONO, fontSize: 10, color: TEXT,
    padding: '8px 10px', borderBottom: `1px solid rgba(255,255,255,0.04)`,
    verticalAlign: 'middle',
  }

  // ── Password screen ───────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{
      background: BG, minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: CARD, border: `1px solid ${DIVIDER}`,
        padding: '36px 40px',
        display: 'flex', flexDirection: 'column', gap: 16,
        width: 340, maxWidth: '92vw',
      }}>
        <div style={{ fontFamily: BEBAS, fontSize: 20, color: ACCENT, letterSpacing: 3 }}>
          ADMIN — SUPPORTERS WORLD CUP
        </div>
        <input
          type="password"
          value={pwd}
          onChange={e => { setPwd(e.target.value); setPwdErr(false) }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="Mot de passe"
          autoFocus
          style={{
            background: '#0a0f1a',
            border: `1px solid ${pwdErr ? DANGER : 'rgba(255,255,255,0.14)'}`,
            color: TEXT, fontFamily: MONO, fontSize: 13,
            padding: '11px 14px', outline: 'none', borderRadius: 2,
          }}
        />
        {pwdErr && (
          <div style={{ color: DANGER, fontSize: 11, marginTop: -8, fontFamily: MONO }}>
            Mot de passe incorrect
          </div>
        )}
        <button
          onClick={handleLogin}
          style={{
            background: 'linear-gradient(135deg, #E8C84A, #c9a830)',
            border: 'none', color: '#05080F',
            fontFamily: BEBAS, fontSize: 15, letterSpacing: 2,
            padding: '13px 0', cursor: 'pointer', borderRadius: 2,
          }}
        >ACCÉDER</button>
        <a href="/" style={{
          fontFamily: MONO, fontSize: 9, color: MUTED,
          textDecoration: 'none', letterSpacing: 1, textAlign: 'center',
        }}>← Retour à la carte</a>
      </div>
    </div>
  )

  // ── Tab button ────────────────────────────────────────────────────────────
  const TabBtn = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        background: tab === id ? 'rgba(232,200,74,0.12)' : 'none',
        border: `1px solid ${tab === id ? 'rgba(232,200,74,0.35)' : 'rgba(255,255,255,0.10)'}`,
        color: tab === id ? ACCENT : MUTED,
        fontFamily: BEBAS, fontSize: 12, letterSpacing: 1.5,
        padding: '7px 14px', cursor: 'pointer', borderRadius: 2,
        whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}
    >{label}</button>
  )

  // ── Main dashboard ────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT }}>

      {/* Header */}
      <div style={{
        background: CARD, borderBottom: `1px solid ${DIVIDER}`,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ fontFamily: BEBAS, fontSize: 18, color: ACCENT, letterSpacing: 3 }}>
          ⚙ ADMIN — SUPPORTERS WORLD CUP
        </div>
        <div style={{ flex: 1 }} />
        <a href="/" style={{
          fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: 1,
          textDecoration: 'none', padding: '5px 10px',
          border: '1px solid rgba(255,255,255,0.10)', borderRadius: 2,
        }}>← CARTE</a>
        <button
          onClick={loadAll}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.12)',
            color: MUTED, fontFamily: MONO, fontSize: 9, letterSpacing: 1,
            padding: '5px 12px', cursor: 'pointer', borderRadius: 2,
          }}
        >↺ REFRESH</button>
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: '1px solid rgba(239,68,68,0.25)',
            color: 'rgba(239,68,68,0.6)', fontFamily: MONO, fontSize: 9,
            padding: '5px 12px', cursor: 'pointer', borderRadius: 2, letterSpacing: 1,
          }}
        >DÉCONNEXION</button>
      </div>

      {/* Tabs */}
      <div style={{
        padding: '10px 20px', display: 'flex', gap: 8, overflowX: 'auto',
        borderBottom: `1px solid ${DIVIDER}`, background: 'rgba(13,19,32,0.6)',
      }}>
        <TabBtn id="overview"  label="Vue d'ensemble" />
        <TabBtn id="countries" label="Pays" />
        <TabBtn id="voices"    label={`Voix (${pixels.length})`} />
        <TabBtn id="comments"  label={`Commentaires (${comments.length})`} />
        <TabBtn id="users"     label={`Utilisateurs (${users.length})`} />
      </div>

      {/* Loading / error */}
      {loading && (
        <div style={{ padding: 48, textAlign: 'center', fontFamily: BEBAS, color: MUTED, letterSpacing: 3 }}>
          CHARGEMENT…
        </div>
      )}
      {error && (
        <div style={{
          margin: 20, padding: '12px 16px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.30)',
          color: DANGER, fontFamily: MONO, fontSize: 11, borderRadius: 2,
        }}>
          Erreur : {error}
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div style={{ padding: 20 }}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                gap: 10,
              }}>
                <StatCard label="PIXELS VENDUS"      value={stats?.totalPixels ?? '—'} />
                <StatCard label="REVENUS TOTAUX"      value={stats?.totalPixels != null ? `${stats.totalPixels} €` : '—'} />
                <StatCard label="UTILISATEURS"        value={stats?.totalUsers ?? '—'} />
                <StatCard label="VOIX ENREGISTRÉES"   value={stats?.totalRecordings ?? '—'} />
                <StatCard label="COMMENTAIRES"        value={stats?.totalComments ?? '—'} />
              </div>
              <div style={{ background: CARD, border: `1px solid ${DIVIDER}`, padding: '16px 18px' }}>
                <div style={{
                  fontFamily: BEBAS, fontSize: 13, color: ACCENT,
                  letterSpacing: 2, marginBottom: 12,
                }}>
                  PIXELS VENDUS — 30 DERNIERS JOURS
                </div>
                <BarChart data={dailyPixels} />
              </div>
            </div>
          )}

          {/* ── COUNTRIES ── */}
          {tab === 'countries' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                <thead>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>Pays</th>
                    <th style={th}>Pixels</th>
                    <th style={th}>Revenus</th>
                    <th style={th}>% rempli</th>
                  </tr>
                </thead>
                <tbody>
                  {countryRanking.map((c, i) => (
                    <tr key={c.iso} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={{ ...td, color: MUTED, width: 36 }}>{i + 1}</td>
                      <td style={td}>
                        <span style={{ fontSize: 22, marginRight: 8 }}>{c.flag}</span>
                        <span style={{ fontFamily: BEBAS, fontSize: 13, letterSpacing: 1 }}>{c.name}</span>
                      </td>
                      <td style={{ ...td, fontFamily: BEBAS, fontSize: 16, color: ACCENT }}>{c.count}</td>
                      <td style={{ ...td, color: MUTED }}>{c.count} €</td>
                      <td style={{ ...td, color: MUTED }}>{((c.count / 40000) * 100).toFixed(2)} %</td>
                    </tr>
                  ))}
                  {countryRanking.length === 0 && (
                    <tr><td colSpan={5} style={{ ...td, textAlign: 'center', padding: 40, color: MUTED }}>
                      Aucune donnée
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── VOICES ── */}
          {tab === 'voices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <SearchInput
                  value={voiceSearch}
                  onChange={setVoiceSearch}
                  placeholder="Filtrer par pseudo, pays, description…"
                />
                <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
                  {filteredPixels.length} / {pixels.length}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={th}>Pays</th>
                      <th style={th}>Pseudo</th>
                      <th style={th}>Description</th>
                      <th style={th}>Audio</th>
                      <th style={th}>♥</th>
                      <th style={th}>Date</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPixels.map((p, i) => {
                      const country = QUALIFIED.find(c => c.iso === p.country_iso)
                      return (
                        <tr key={p.id} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                          <td style={td}>
                            <span style={{ fontSize: 20, marginRight: 4 }}>{country?.flag ?? '🏳️'}</span>
                            <span style={{ fontFamily: MONO, fontSize: 8, color: MUTED }}>
                              {p.country_iso.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ ...td, fontFamily: BEBAS, fontSize: 13, color: ACCENT, letterSpacing: 0.5 }}>
                            {p.pseudo || <span style={{ color: MUTED, fontFamily: MONO, fontSize: 9 }}>—</span>}
                          </td>
                          <td style={{ ...td, maxWidth: 220, color: MUTED, fontSize: 9, lineHeight: 1.5 }}>
                            {p.description
                              ? <span title={p.description}>
                                  {p.description.length > 90 ? p.description.slice(0, 90) + '…' : p.description}
                                </span>
                              : '—'}
                          </td>
                          <td style={td}><AudioBtn url={p.audio_url} /></td>
                          <td style={{ ...td, color: MUTED }}>{p.likes ?? 0}</td>
                          <td style={{ ...td, color: MUTED, fontSize: 9, whiteSpace: 'nowrap' }}>
                            {fmtShort(p.created_at)}
                          </td>
                          <td style={td}>
                            <DeleteBtn onDelete={() => handleDeletePixel(p)} />
                          </td>
                        </tr>
                      )
                    })}
                    {filteredPixels.length === 0 && (
                      <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 40, color: MUTED }}>
                        Aucune voix
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COMMENTS ── */}
          {tab === 'comments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <SearchInput
                  value={commentSearch}
                  onChange={setCommentSearch}
                  placeholder="Filtrer les commentaires…"
                />
                <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
                  {filteredComments.length} / {comments.length}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                  <thead>
                    <tr>
                      <th style={th}>Contenu</th>
                      <th style={th}>Pixel ID</th>
                      <th style={th}>Date</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComments.map((c, i) => (
                      <tr key={c.id} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={{ ...td, maxWidth: 480, lineHeight: 1.5 }}>{c.content}</td>
                        <td style={{ ...td, color: MUTED, fontSize: 8, fontFamily: MONO }}>
                          {c.pixel_id?.slice(0, 8)}…
                        </td>
                        <td style={{ ...td, color: MUTED, fontSize: 9, whiteSpace: 'nowrap' }}>
                          {fmtDate(c.created_at)}
                        </td>
                        <td style={td}>
                          <DeleteBtn onDelete={() => handleDeleteComment(c)} />
                        </td>
                      </tr>
                    ))}
                    {filteredComments.length === 0 && (
                      <tr><td colSpan={4} style={{ ...td, textAlign: 'center', padding: 40, color: MUTED }}>
                        Aucun commentaire
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                <thead>
                  <tr>
                    <th style={th}>Email</th>
                    <th style={th}>Prénom</th>
                    <th style={th}>Nom</th>
                    <th style={th}>Pixels achetés</th>
                    <th style={th}>Inscription</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ background: i % 2 !== 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={{ ...td, color: ACCENT }}>{u.email ?? '—'}</td>
                      <td style={td}>{u.first_name ?? '—'}</td>
                      <td style={td}>{u.last_name  ?? '—'}</td>
                      <td style={{ ...td, fontFamily: BEBAS, fontSize: 16, color: pixelCountByUser[u.id] ? ACCENT : MUTED }}>
                        {pixelCountByUser[u.id] ?? 0}
                      </td>
                      <td style={{ ...td, color: MUTED, fontSize: 9, whiteSpace: 'nowrap' }}>
                        {fmtDate(u.created_at)}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} style={{ ...td, textAlign: 'center', padding: 40, color: MUTED }}>
                      Aucun utilisateur
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
