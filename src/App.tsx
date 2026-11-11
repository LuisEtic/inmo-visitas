import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './components/AuthProvider'
import { RequireAuth } from './components/RequireAuth'
import DesignSystem from './pages/DesignSystem'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Register from './pages/Register'

/**
 * Fase 2: rutas con react-router en modo declarativo.
 * - Públicas: /login, /registro, /design-system.
 * - Privadas: / (inicio provisional) y /perfil (redirigen a /login
 *   sin sesión y vuelven a la ruta pedida tras entrar).
 * El basename es la base donde se sirve la app: '/' en local y en
 * Coolify con dominio propio, '/inmo-visitas/' en GitHub Pages (staging).
 * Sin basename, /login, /registro y /perfil resolverían a la raíz del
 * dominio y darían 404 en Pages.
 */
function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/design-system" element={<DesignSystem />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/perfil"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
