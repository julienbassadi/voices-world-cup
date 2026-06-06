import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PixelPage from './pages/PixelPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

const path = window.location.pathname
const pixelMatch = path.match(/^\/pixel\/([^/]+)$/)
const isAdmin = path === '/admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdmin ? <AdminPage /> : pixelMatch ? <PixelPage pixelId={pixelMatch[1]} /> : <App />}
  </StrictMode>,
)
