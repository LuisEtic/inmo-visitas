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
const Clients = lazy(() => import('./pages/Clients'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const Properties = lazy(() => import('./pages/Properties'))
const PropertyDetail = lazy(() => import('./pages/PropertyDetail'))
const Capture = lazy(() => import('./pages/Capture'))
const NoteDetail = lazy(() => import('./pages/NoteDetail'))
const Notes = lazy(() => import('./pages/Notes'))
const Pending = lazy(() => import('./pages/Pending'))
const PrivacyActions = lazy(() => import('./pages/PrivacyActions'))

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
            <Route
              path="/perfil/acciones"
              element={
                <RequireAuth>
                  <PrivacyActions />
                </RequireAuth>
              }
            />
            <Route
              path="/clientes"
              element={
                <RequireAuth>
                  <Clients />
                </RequireAuth>
              }
            />
            <Route
              path="/clientes/nuevo"
              element={
                <RequireAuth>
                  <ClientDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/clientes/:id"
              element={
                <RequireAuth>
                  <ClientDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/inmuebles"
              element={
                <RequireAuth>
                  <Properties />
                </RequireAuth>
              }
            />
            <Route
              path="/inmuebles/nuevo"
              element={
                <RequireAuth>
                  <PropertyDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/inmuebles/:id"
              element={
                <RequireAuth>
                  <PropertyDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/capturar"
              element={
                <RequireAuth>
                  <Capture />
                </RequireAuth>
              }
            />
            <Route
              path="/notas/:id"
              element={
                <RequireAuth>
                  <NoteDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/notas"
              element={
                <RequireAuth>
                  <Notes />
                </RequireAuth>
              }
            />
            <Route
              path="/pendientes"
              element={
                <RequireAuth>
                  <Pending />
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
