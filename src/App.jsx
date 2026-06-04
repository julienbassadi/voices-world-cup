import { useState, useCallback, useRef, useEffect } from 'react'
import WorldMap, { QUALIFIED } from './components/WorldMap'
import Sidebar from './components/Sidebar'
import HUD from './components/HUD'
import AudioLayer from './components/AudioLayer'
import Auth from './components/Auth'
import PixelModal from './components/PixelModal'
import useMapStore from './store/mapStore'

export default function App() {
  const [selectedCountry, setSelectedCountry]     = useState(null)
  const [lastHoveredCountry, setLastHoveredCountry] = useState(null)
  const [showAuth, setShowAuth]                   = useState(false)
  const [pixelModal, setPixelModal]               = useState(null) // { country, pixel }
  const authCallbackRef                           = useRef(null)

  useEffect(() => {
    useMapStore.getState().loadPixels()
    return useMapStore.getState().subscribeToPixels()
  }, [])

  const handleCountryClick = useCallback(country => setSelectedCountry(country), [])
  const handleCountryHover = useCallback(country => setLastHoveredCountry(country), [])

  const handlePixelDoubleClick = useCallback(({ iso, pixel }) => {
    const country = QUALIFIED.find(c => c.iso === iso)
    if (country && pixel) setPixelModal({ country, pixel })
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setSelectedCountry(null)
    useMapStore.getState().clearPendingPixels()
  }, [])

  const handleOpenSidebar = useCallback(
    () => setSelectedCountry(lastHoveredCountry),
    [lastHoveredCountry]
  )

  const handleNeedAuth = useCallback((cb) => {
    authCallbackRef.current = cb
    setShowAuth(true)
  }, [])

  const handleAuthSuccess = useCallback(() => {
    setShowAuth(false)
    const cb = authCallbackRef.current
    authCallbackRef.current = null
    cb?.()
  }, [])

  const handleAuthClose = useCallback(() => {
    setShowAuth(false)
    authCallbackRef.current = null
  }, [])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <WorldMap
        onCountryClick={handleCountryClick}
        onCountryHover={handleCountryHover}
        onPixelDoubleClick={handlePixelDoubleClick}
      />
      <HUD
        lastHoveredCountry={lastHoveredCountry}
        onOpenSidebar={handleOpenSidebar}
      />
      <Sidebar
        country={selectedCountry}
        onClose={handleCloseSidebar}
        onNeedAuth={handleNeedAuth}
      />
      <AudioLayer />
      {showAuth && (
        <Auth
          onClose={handleAuthClose}
          onSuccess={handleAuthSuccess}
        />
      )}
      {pixelModal && (
        <PixelModal
          country={pixelModal.country}
          pixel={pixelModal.pixel}
          onClose={() => setPixelModal(null)}
        />
      )}
    </div>
  )
}
