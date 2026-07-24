import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Base path is parameterized so the SAME source builds for two homes:
//   • GitHub Pages (default):     /job-work-tracker/   (npm run build / deploy)
//   • Firebase Hosting root:      /                    (APP_BASE=/ npm run build)
// Firebase Hosting serves the app same-origin with its Google auth handler, which
// is what makes sign-in work inside the installed iPhone PWA (github.io could not).
const BASE = process.env.APP_BASE || '/job-work-tracker/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      scope: BASE,
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        navigateFallback: `${BASE}index.html`,
        navigateFallbackAllowlist: [new RegExp('^' + BASE)],
        // NEVER let the service worker serve the SPA shell for:
        //  • /__/auth/*  — Firebase's reserved auth handler + iframe. Shadowing it made
        //    Google sign-in boot the app inside the auth iframe → recursion → white screen.
        //  • /welder/*   — the welder app is co-hosted on this same origin. Plating's SW
        //    scope is '/', so without this it would serve the PLATING shell on welder URLs.
        navigateFallbackDenylist: [/^\/__/, /^\/welder/],
      },
      manifest: {
        name: 'Plating Job Work',
        short_name: 'Plating',
        description: 'Track plating job work — challans, balances, reminders',
        theme_color: '#1e293b',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
