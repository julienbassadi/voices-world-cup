import { useState, useEffect, useRef } from 'react'
import useMapStore from '../store/mapStore'
import useAuthStore from '../store/authStore'
import { supabase } from '../lib/supabase'

const BEBAS = "'Bebas Neue', Impact, sans-serif"
const MONO  = "'DM Mono', monospace"

export default function Sidebar({ country, onClose, onNeedAuth }) {
  const [recState, setRecState]     = useState('idle')
  const [timeLeft, setTimeLeft]     = useState(30)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [micError, setMicError]     = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [isCommitting, setIsCommitting] = useState(false)
  const [isLight, setIsLight]       = useState(
    () => document.documentElement.getAttribute('data-theme') === 'light'
  )
  const [pseudo, setPseudo]             = useState('')
  const [description, setDescription]   = useState('')
  const [selectedColor, setSelectedColor] = useState('#E8C84A')

  const mediaRecorderRef = useRef(null)
  const streamRef        = useRef(null)
  const audioChunksRef   = useRef([])
  const audioBlobRef     = useRef(null)
  const audioUrlRef      = useRef(null)
  const audioPlayerRef   = useRef(null)
  const timerRef         = useRef(null)

  const pixelsByCountry = useMapStore(s => s.pixelsByCountry)
  const pendingPixels   = useMapStore(s => s.pendingPixels)
  const currentPixels   = (pixelsByCountry[country?.iso] ?? []).length
  const pendingCount    = pendingPixels.size
  const isLoggedIn      = useAuthStore(s => s.isLoggedIn)
  const user            = useAuthStore(s => s.user)

  // Mirror theme changes from HUD
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // Reset everything when country changes
  useEffect(() => {
    stopRecording()
    revokeAudioUrl()
    clearInterval(timerRef.current)
    setRecState('idle')
    setTimeLeft(30)
    setIsPlaying(false)
    setMicError(null)
    setUploadError(null)
    setPseudo('')
    setDescription('')
    setSelectedColor('#E8C84A')
    // confirmedPixels intentionally NOT cleared here — they must stay visible
    // on the map after purchase even when the sidebar closes
  }, [country?.iso])

  // Cleanup on unmount
  useEffect(() => () => {
    stopRecording()
    revokeAudioUrl()
    clearInterval(timerRef.current)
  }, [])

  // Countdown tick while recording
  useEffect(() => {
    if (recState !== 'recording') return
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    timerRef.current = id
    return () => clearInterval(id)
  }, [recState])

  // Auto-stop at 0
  useEffect(() => {
    if (recState === 'recording' && timeLeft === 0) {
      clearInterval(timerRef.current)
      mediaRecorderRef.current?.stop()
    }
  }, [recState, timeLeft])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  function revokeAudioUrl() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
    audioBlobRef.current = null
    audioChunksRef.current = []
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStartRecording = () => {
    if (recState !== 'idle' || pendingCount === 0) return
    if (!isLoggedIn) {
      onNeedAuth?.(() => setRecState('ready'))
      return
    }
    setMicError(null)
    setRecState('ready')
  }

  const handleBeginRecording = async () => {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        revokeAudioUrl()
        audioBlobRef.current = blob
        audioUrlRef.current = URL.createObjectURL(blob)
        stream.getTracks().forEach(t => t.stop())
        setRecState('review')
      }

      recorder.start()
      setTimeLeft(30)
      setRecState('recording')
    } catch (err) {
      console.error('Micro access denied:', err)
      setMicError('Accès au microphone refusé.')
      setRecState('ready')
    }
  }

  const handleStop = () => {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    // onstop sets recState to 'review'
  }

  const handleReplay = () => {
    if (isPlaying || !audioUrlRef.current) return
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
    const audio = new Audio(audioUrlRef.current)
    audioPlayerRef.current = audio
    audio.onended = () => { setIsPlaying(false); audioPlayerRef.current = null }
    audio.play()
    setIsPlaying(true)
  }

  const handleRedo = () => {
    clearInterval(timerRef.current)
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
    revokeAudioUrl()
    setIsPlaying(false)
    setTimeLeft(30)
    setRecState('ready')
  }

  const handleValidate = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
    setIsPlaying(false)
    setRecState('validated')
  }

  const handleBack = () => setRecState('review')

  const handleCommit = async () => {
    console.log('audioBlob:', audioBlobRef.current)
    console.log('recState:', recState)
    if (!country || recState !== 'validated' || pendingCount === 0) {
      setUploadError('Conditions non remplies. Veuillez sélectionner des pixels et valider un enregistrement.')
      return
    }
    if (!audioBlobRef.current) {
      setUploadError('Aucun enregistrement audio trouvé. Recommencez l\'enregistrement.')
      return
    }
    if (!user?.id) {
      setUploadError('Vous devez être connecté pour valider.')
      return
    }

    setIsCommitting(true)
    setUploadError(null)

    try {
      // ── 1. Upload audio ──────────────────────────────────────────────────
      const ext  = audioBlobRef.current.type.includes('mp4') ? 'mp4' : 'webm'
      const path = `${user.id}/${country.iso}/${Date.now()}.${ext}`
      console.log('Upload audio...', { path, size: audioBlobRef.current.size, type: audioBlobRef.current.type })

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('audio')
        .upload(path, audioBlobRef.current, { contentType: audioBlobRef.current.type, upsert: false })

      if (uploadErr) {
        console.error('Erreur upload Supabase Storage:', uploadErr)
        throw new Error(`Upload échoué : ${uploadErr.message}`)
      }

      console.log('Upload réussi :', uploadData)
      const { data: { publicUrl } } = supabase.storage.from('audio').getPublicUrl(path)
      console.log('Upload réussi, URL :', publicUrl)

      // ── 2. Insertion pixels ──────────────────────────────────────────────
      console.log('Insertion pixels...')
      await useMapStore.getState().commitPendingPixels({
        audioUrl: publicUrl,
        pseudo: pseudo.trim() || null,
        description: description.trim() || null,
        color: selectedColor !== '#E8C84A' ? selectedColor : null,
      })
      console.log('Pixels insérés avec succès')

      onClose()
    } catch (err) {
      console.error('[Sidebar.handleCommit] Erreur complète :', err)
      setUploadError(err.message ?? 'Erreur inconnue.')
    } finally {
      setIsCommitting(false)
    }
  }

  if (!country) return null

  const progressPct = (timeLeft / 30) * 100

  const accent     = isLight ? '#1a3080' : '#E8C84A'
  const sidebarBg  = isLight ? '#ffffff' : 'var(--bg-secondary)'
  const mutedColor = isLight ? 'rgba(26,48,128,0.6)' : 'var(--text-muted)'
  const dividerClr = isLight ? 'rgba(26,48,128,0.12)' : 'rgba(232,200,74,0.12)'
  const btnBg      = isLight ? '#1a3080' : 'rgba(255,255,255,0.04)'
  const btnBorder  = isLight ? '#1a3080' : 'rgba(255,255,255,0.1)'
  const btnColor   = isLight ? '#ffffff' : 'var(--text-muted)'
  const shadow     = isLight ? '0 2px 12px rgba(0,0,0,0.15)' : 'none'

  const confirmActive = recState === 'idle' && pendingCount > 0
  const commitActive  = recState === 'validated' && pendingCount > 0

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
        position: 'absolute', top: 16, left: 18,
        background: 'none', border: 'none',
        color: mutedColor, fontSize: 20,
        cursor: 'pointer', lineHeight: 1, padding: 6, fontFamily: MONO,
      }}>✕</button>

      {/* Country header */}
      <div style={{ padding: '36px 28px 20px', paddingLeft: 52 }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10 }}>{country.flag}</div>
        <div style={{ fontFamily: BEBAS, fontSize: 32, color: accent, letterSpacing: 2 }}>
          {country.name}
        </div>
        <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 11, marginTop: 4, letterSpacing: 1 }}>
          {currentPixels} voix déjà enregistrée{currentPixels !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ height: 1, background: dividerClr, margin: '0 28px' }} />

      {/* ── Meta: pseudo, description, color ── */}
      <div style={{ padding: '14px 28px 0' }}>
        <input
          type="text"
          value={pseudo}
          onChange={e => setPseudo(e.target.value)}
          placeholder="Prénom / pseudo (optionnel)"
          maxLength={50}
          className="sidebar-meta-input"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: isLight ? 'rgba(26,48,128,0.06)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${dividerClr}`,
            color: isLight ? '#1a2040' : '#F0F0F0',
            fontFamily: MONO, fontSize: 11, letterSpacing: 0.5,
            padding: '9px 12px', borderRadius: 2, outline: 'none',
            marginBottom: 8,
          }}
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Message / lien (optionnel)"
          rows={2}
          maxLength={280}
          className="sidebar-meta-input"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: isLight ? 'rgba(26,48,128,0.06)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${dividerClr}`,
            color: isLight ? '#1a2040' : '#F0F0F0',
            fontFamily: MONO, fontSize: 11, letterSpacing: 0.5,
            padding: '9px 12px', borderRadius: 2, outline: 'none',
            resize: 'none', lineHeight: 1.5, marginBottom: 8,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="color"
            value={selectedColor}
            onChange={e => setSelectedColor(e.target.value)}
            title="Couleur du pixel"
            style={{
              width: 32, height: 26, border: 'none', cursor: 'pointer',
              padding: 0, background: 'none', borderRadius: 2,
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: 9, color: mutedColor, letterSpacing: 1.5 }}>
            COULEUR DU PIXEL
          </span>
          <div style={{
            width: 12, height: 12, borderRadius: '50%', marginLeft: 'auto',
            background: selectedColor, border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0,
          }} />
        </div>
      </div>

      <div style={{ height: 1, background: dividerClr, margin: '14px 28px 0' }} />

      {/* ── Recording section ── */}
      <div style={{ padding: '18px 28px 0' }}>

        {/* IDLE */}
        {recState === 'idle' && (
          <div style={{
            fontFamily: MONO, fontSize: 11, letterSpacing: 1,
            color: pendingCount > 0 ? accent : mutedColor,
            textAlign: 'center', padding: '12px 0', lineHeight: 1.6,
          }}>
            {pendingCount > 0
              ? <>
                  <span style={{ fontSize: 22, fontFamily: BEBAS, display: 'block', letterSpacing: 2, marginBottom: 2 }}>
                    {pendingCount} PIXEL{pendingCount > 1 ? 'S' : ''} SÉLECTIONNÉ{pendingCount > 1 ? 'S' : ''}
                  </span>
                  Cliquez sur d'autres pixels pour en ajouter,<br />
                  ou sur un pixel doré pour le retirer.
                </>
              : 'Cliquez sur les pixels vides de la carte\npour les sélectionner.'
            }
          </div>
        )}

        {/* READY */}
        {recState === 'ready' && (
          <div style={{ textAlign: 'center', padding: '14px 0' }}>
            <button onClick={handleBeginRecording} style={{
              width: '100%', padding: '15px 0',
              background: 'rgba(29,185,84,0.08)',
              border: '1px solid rgba(29,185,84,0.45)',
              color: '#1DB954',
              fontFamily: MONO, fontSize: 13, letterSpacing: 2,
              cursor: 'pointer', borderRadius: 2,
            }}>
              🎙 ENREGISTRER
            </button>
            {micError && (
              <div style={{ fontFamily: MONO, color: '#EF4444', fontSize: 10, marginTop: 10, letterSpacing: 0.5 }}>
                {micError}
              </div>
            )}
            {!micError && (
              <div style={{ fontFamily: MONO, color: mutedColor, fontSize: 10, marginTop: 10, letterSpacing: 1 }}>
                Appuyez pour démarrer le chrono de 30s
              </div>
            )}
          </div>
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

      {/* ── Bottom — pinned buttons ── */}
      <div style={{ marginTop: 'auto', padding: '20px 28px 32px' }}>

        {uploadError && (
          <div style={{ fontFamily: MONO, color: '#EF4444', fontSize: 10, letterSpacing: 0.5, marginBottom: 10 }}>
            {uploadError}
          </div>
        )}

        {recState === 'idle' && pendingCount === 0 && (
          <div style={{
            fontFamily: MONO, color: mutedColor, fontSize: 10,
            letterSpacing: 1, textAlign: 'center', marginBottom: 10, opacity: 0.7,
          }}>
            Sélectionnez au moins 1 pixel sur la carte
          </div>
        )}

        {confirmActive && (
          <button
            onClick={handleStartRecording}
            style={{
              width: '100%', padding: '15px 20px',
              background: isLight
                ? 'linear-gradient(135deg, #1a3080 0%, #2a45b0 100%)'
                : 'linear-gradient(135deg, #E8C84A 0%, #c9a830 100%)',
              border: 'none',
              color: isLight ? '#ffffff' : '#05080F',
              fontFamily: BEBAS, fontSize: 17, letterSpacing: 3,
              cursor: 'pointer', borderRadius: 2,
              transition: 'all 0.25s', boxShadow: shadow, whiteSpace: 'nowrap',
            }}
          >
            CONFIRMER {pendingCount} PIXEL{pendingCount > 1 ? 'S' : ''} — {pendingCount}€
          </button>
        )}

        {commitActive && (
          <button
            onClick={handleCommit}
            disabled={isCommitting}
            style={{
              width: '100%', padding: '15px 20px',
              background: isCommitting
                ? (isLight ? 'rgba(26,48,128,0.15)' : 'rgba(255,255,255,0.06)')
                : (isLight
                    ? 'linear-gradient(135deg, #1a3080 0%, #2a45b0 100%)'
                    : 'linear-gradient(135deg, #E8C84A 0%, #c9a830 100%)'),
              border: 'none',
              color: isCommitting
                ? mutedColor
                : (isLight ? '#ffffff' : '#05080F'),
              fontFamily: BEBAS, fontSize: 17, letterSpacing: 3,
              cursor: isCommitting ? 'not-allowed' : 'pointer',
              borderRadius: 2, transition: 'all 0.25s', boxShadow: shadow,
            }}
          >
            {isCommitting ? 'ENVOI EN COURS…' : 'CONFIRMER L\'ACHAT'}
          </button>
        )}
      </div>
    </div>
  )
}
