import { useState, useCallback } from 'react'
import WorldMap from './components/WorldMap'
import Sidebar from './components/Sidebar'
import HUD from './components/HUD'
import AudioLayer from './components/AudioLayer'

export default function App() {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [lastHoveredCountry, setLastHoveredCountry] = useState(null)

  // Stable callbacks so WorldMap's callbacksRef stays fresh
  const handleCountryClick  = useCallback(country => setSelectedCountry(country), [])
  const handleCountryHover  = useCallback(country => setLastHoveredCountry(country), [])
  const handleCloseSidebar  = useCallback(() => setSelectedCountry(null), [])
  const handleOpenSidebar   = useCallback(() => setSelectedCountry(lastHoveredCountry), [lastHoveredCountry])

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
      />
      <AudioLayer />
    </div>
  )
}
