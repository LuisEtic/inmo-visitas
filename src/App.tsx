import DesignSystem from './pages/DesignSystem'

/**
 * Fase 1: la única ruta es /design-system (showcase del sistema de diseño).
 * La raíz muestra un enlace a esa ruta. No hay login, ni CRUD, ni lógica
 * de negocio en esta fase.
 */
function App() {
  const pathname = window.location.pathname
  const isDesignSystem =
    pathname === '/design-system' ||
    pathname.endsWith('/design-system') ||
    pathname.endsWith('/design-system/')
  if (isDesignSystem) {
    return <DesignSystem />
  }

  return (
    <main className="mx-auto max-w-4xl bg-bg px-4 py-12 text-text-primary">
      <h1 className="text-2xl">Inmo Visitas</h1>
      <p className="mt-2 text-base text-text-secondary">
        Notas de visita por voz o texto para agentes inmobiliarios.
      </p>
      <p className="mt-6 text-sm">
        Fase 1 — Fundación: modelo de datos + sistema de diseño Minimal-Mono.
      </p>
      <a
        href={`${import.meta.env.BASE_URL}design-system`}
        className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
      >
        Ver sistema de diseño
      </a>
    </main>
  )
}

export default App
