/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // base relativa: funziona sia in locale sia in una sottocartella (es. GitHub Pages /<repo>/)
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'robots.txt'],
      manifest: {
        name: 'Quiz Patente B — listato ufficiale',
        short_name: 'Quiz Patente',
        description: "Simulatore dell'esame di teoria patente B basato sul listato ufficiale MIT",
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f3f3f1',
        theme_color: '#2a78d6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // tutto il listato (dati + 407 figure) resta disponibile offline
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 2500 },
  test: { include: ['src/**/*.test.ts'] },
})
