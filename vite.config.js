import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'La KZ POS',
        // by #JDMRules
        short_name: 'La KZ',
        description: 'Sistema POS - La KZ',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
  },
})
