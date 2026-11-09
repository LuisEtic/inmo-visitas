import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Ruta donde se sirve la app. Por defecto '/', que es lo correcto en
  // Coolify con dominio propio (p. ej. https://visitas.agencia.com).
  // Solo si se publica en una subcarpeta (p. ej. GitHub Pages en
  // /inmo-visitas/) hay que definir VITE_BASE_PATH=/inmo-visitas/.
  const rawBase = env.VITE_BASE_PATH?.trim() || '/'
  const base = `/${rawBase.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Inmo Visitas',
          short_name: 'Inmo Visitas',
          description:
            'Notas de visita por voz o texto para agentes inmobiliarios.',
          theme_color: '#FFFFFF',
          background_color: '#FFFFFF',
          display: 'standalone',
          lang: 'es',
          // La app instalada debe abrirse dentro de su propia ruta.
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}favicon.svg`,
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
      }),
    ],
  }
})
