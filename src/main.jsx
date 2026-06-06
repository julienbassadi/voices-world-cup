import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PixelPage from './pages/PixelPage.jsx'

const path = window.location.pathname
const pixelMatch = path.match(/^\/pixel\/([^/]+)$/)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {pixelMatch ? <PixelPage pixelId={pixelMatch[1]} /> : <App />}
  </StrictMode>,
)
