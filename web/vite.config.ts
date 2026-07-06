import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Deployments under a subpath (e.g. GitHub Pages serves /BankrollEdge/) set
// PAGES_BASE; local dev and root-hosted deployments use '/'.
const base = process.env.PAGES_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The manifest is authored by hand in public/manifest.webmanifest.
      manifest: false,
      includeAssets: ['offline.html', 'icons/*'],
      workbox: {
        // Everything is local-first: precache the whole app shell so the app
        // works fully offline. Cache versioning + cleanup are handled by
        // Workbox (precache revisions + cleanupOutdatedCaches).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        // SPA routing: any navigation falls back to the cached index.html.
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
} as Parameters<typeof defineConfig>[0]);
