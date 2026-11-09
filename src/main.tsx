import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes autoalojadas (sin Google Fonts: evita enviar la IP del visitante a terceros, RGPD)
import '@fontsource-variable/inter'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
