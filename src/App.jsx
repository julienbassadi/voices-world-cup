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
  const [countryModal, setCountryModal]         = useState(null) // country → opens pixel grid modal
  const [selectedCountry, setSelectedCountry]   = useState(null) // country → opens recording sidebar
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

  // "ACHETER" button in CountryModal → close modal, open recording sidebar
  const handleModalBuy = useCallback(country => {
    setCountryModal(null)
    setSelectedCountry(country)
  }, [])

  const handleModalClose = useCallback(() => {
    setCountryModal(null)
    useMapStore.getState().clearGridPendingPixels()
  }, [])

  // Double-click on purchased pixel in CountryModal → open VocalSpace
  const handlePixelDoubleClick = useCallback(({ iso, pixel }) => {
    const country = QUALIFIED.find(c => c.iso === iso)
    if (!country || !pixel) return
    setCountryModal(null)
    setSelectedCountry(null)
    useMapStore.getState().clearGridPendingPixels()
    setPixelView({ country, pixel })
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setSelectedCountry(null)
    setPixelView(null)
    useMapStore.getState().clearGridPendingPixels()
  }, [])

  // HUD bottom button — open pixel grid modal for last hovered country
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
      {pixelView ? (
        <VocalSpace
          country={pixelView.country}
          pixel={pixelView.pixel}
          onClose={handleCloseSidebar}
        />
      ) : (
        <Sidebar
          country={selectedCountry}
          onClose={handleCloseSidebar}
          onNeedAuth={handleNeedAuth}
        />
      )}
      {countryModal && (
        <CountryModal
          country={countryModal}
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
