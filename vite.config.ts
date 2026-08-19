/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Le service worker se met à jour tout seul : l'utilisatrice n'a jamais
      // à « réinstaller » l'app pour recevoir un correctif.
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        // Par défaut Workbox ignore les .wasm : sans cela le scan cesserait de
        // fonctionner hors-ligne. Le fichier pèse 1 Mo, sous la limite de 2 Mo.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm}'],
      },
      manifest: {
        name: 'Catalogue de disques',
        short_name: 'Disques',
        description: 'Inventaire d\'une collection de disques vinyles',
        lang: 'fr-CA',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1c1917',
        background_color: '#1c1917',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
});
