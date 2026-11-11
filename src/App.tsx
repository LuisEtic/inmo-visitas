import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './components/AuthProvider'
import { RequireAuth } from './components/RequireAuth'

// Cada pantalla en su propio trozo JS: solo se descarga al visitarla
// (revisión Fase 2, aviso de Vite por paquete > 500 kB).
const DesignSystem = lazy(() => import('./pages/DesignSystem'))
const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Profile = lazy(() => import('./pages/Profile'))
const Register = lazy(() => import('./pages/Register'))

function PageFallback() {
  return (
    <main className="mx-auto max-w-md bg-bg px-4 py-12 text-text-primary">
      <p className="text-sm text-text-secondary">Cargando…</p>
    </main>
  )
}

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
        <Suspense fallback={<PageFallback />}>
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
