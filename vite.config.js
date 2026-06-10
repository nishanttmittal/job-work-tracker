import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/job-work-tracker/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      scope: '/job-work-tracker/',
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        navigateFallback: '/job-work-tracker/index.html',
        navigateFallbackAllowlist: [/^\/job-work-tracker/],
      },
      manifest: {
        name: 'Plating Job Work',
        short_name: 'Plating',
        description: 'Track plating job work — challans, balances, reminders',
        theme_color: '#1e293b',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/job-work-tracker/',
        scope: '/job-work-tracker/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
