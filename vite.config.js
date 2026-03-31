import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Equipment Maintenance Logger',
        short_name: 'Maintenance',
        description: 'Scan QR codes and log equipment maintenance records',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // Cache the app shell and all assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit for flextram.png
        // Cache Supabase API responses for offline reading
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              networkTimeoutSeconds: 5,
            }
          },
          {
            // Cache static fleet PDFs (documents bucket) — offline access
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/documents\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-docs',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            }
          },
          {
            // Inspection/drop-off photos — don't hoard in cache, fetch fresh
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/inspection-photos\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'inspection-photos',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              networkTimeoutSeconds: 5,
            }
          }
        ]
      }
    })
  ]
})
