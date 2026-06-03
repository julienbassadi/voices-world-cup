import { useState, useCallback, useRef } from 'react'
import WorldMap from './components/WorldMap'
import Sidebar from './components/Sidebar'
import HUD from './components/HUD'
import AudioLayer from './components/AudioLayer'
import Auth from './components/Auth'
import useMapStore from './store/mapStore'

export default function App() {
  const [selectedCountry, setSelectedCountry]     = useState(null)
  const [lastHoveredCountry, setLastHoveredCountry] = useState(null)
  const [showAuth, setShowAuth]                   = useState(false)
  const authCallbackRef                           = useRef(null)

  const handleCountryClick = useCallback(country => setSelectedCountry(country), [])
  const handleCountryHover = useCallback(country => setLastHoveredCountry(country), [])

  const handleCloseSidebar = useCallback(() => {
    setSelectedCountry(null)
    useMapStore.getState().clearPendingPixels()
  }, [])

  const handleOpenSidebar = useCallback(
    () => setSelectedCountry(lastHoveredCountry),
    [lastHoveredCountry]
  )

  // Called by Sidebar when user needs to log in before proceeding.
  // cb = what to run after successful auth (e.g. start recording).
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
    </div>
  )
}
