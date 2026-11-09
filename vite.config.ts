import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages sirve el repo en /inmo-visitas/, no en la raíz.
  base: '/inmo-visitas/',
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
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
