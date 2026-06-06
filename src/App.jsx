import { useState, useCallback, useRef, useEffect } from 'react'
import WorldMap, { QUALIFIED } from './components/WorldMap'
import Sidebar from './components/Sidebar'
import CountryModal from './components/CountryModal'
import HUD from './components/HUD'
import AudioLayer from './components/AudioLayer'
import Auth from './components/Auth'
import VocalSpace from './components/VocalSpace'
import useMapStore from './store/mapStore'

export default function App() {
  const [countryModal, setCountryModal]         = useState(null) // country → pixel grid modal
  const [selectedCountry, setSelectedCountry]   = useState(null) // country → recording sidebar
  const [lastHoveredCountry, setLastHoveredCountry] = useState(null)
  const [showAuth, setShowAuth]                 = useState(false)
  const [pixelView, setPixelView]               = useState(null) // { country, pixel }
  const authCallbackRef                         = useRef(null)

  useEffect(() => {
    useMapStore.getState().loadPixels()
    return useMapStore.getState().subscribeToPixels()
  }, [])

  const handleCountryClick = useCallback(country => {
    setPixelView(null)
    setSelectedCountry(null)
    setCountryModal(country)
  }, [])

  const handleCountryHover = useCallback(country => setLastHoveredCountry(country), [])

  // "ACHETER" in CountryModal → open sidebar alongside the modal (modal stays open)
  const handleModalBuy = useCallback(country => {
    setSelectedCountry(country)
  }, [])

  // Closing the modal also closes the sidebar and clears pending selection
  const handleModalClose = useCallback(() => {
    setCountryModal(null)
    setSelectedCountry(null)
    useMapStore.getState().clearGridPendingPixels()
  }, [])

  // Double-click on purchased pixel inside CountryModal → VocalSpace
  const handlePixelDoubleClick = useCallback(({ iso, pixel }) => {
    const country = QUALIFIED.find(c => c.iso === iso)
    if (!country || !pixel) return
    setCountryModal(null)
    setSelectedCountry(null)
    useMapStore.getState().clearGridPendingPixels()
    setPixelView({ country, pixel })
  }, [])

  // Sidebar close: only close sidebar — modal stays open with current selection visible
  const handleCloseSidebar = useCallback(() => {
    setSelectedCountry(null)
    setPixelView(null)
  }, [])

  // HUD bottom button → open pixel grid modal for last hovered country
  const handleOpenSidebar = useCallback(
    () => setCountryModal(lastHoveredCountry),
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
      />
      <HUD
        lastHoveredCountry={lastHoveredCountry}
        onOpenSidebar={handleOpenSidebar}
      />

      {/* VocalSpace overlays everything */}
      {pixelView && (
        <VocalSpace
          country={pixelView.country}
          pixel={pixelView.pixel}
          onClose={handleCloseSidebar}
        />
      )}

      {/* Sidebar: above modal when countryModal is open */}
      {!pixelView && (
        <Sidebar
          country={selectedCountry}
          onClose={handleCloseSidebar}
          onNeedAuth={handleNeedAuth}
          zIndex={countryModal ? 1100 : 300}
        />
      )}

      {/* Country pixel grid modal */}
      {countryModal && (
        <CountryModal
          country={countryModal}
          sidebarOpen={!!selectedCountry}
          onClose={handleModalClose}
          onBuy={handleModalBuy}
          onNeedAuth={handleNeedAuth}
          onPixelDoubleClick={handlePixelDoubleClick}
        />
      )}

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
