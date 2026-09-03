/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// This app has no backend. Every `firebase/firestore` import resolves to the
// local SQLite-backed shim in src/localdb/localFirestore.ts, so all of
// src/domains/**Api.ts run against on-device storage and the bundle never
// talks to a network. Auth is the client-side provider in src/auth/localAuth.ts.
function resolveTo(path: string) {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: [
      { find: 'firebase/firestore', replacement: resolveTo('./src/localdb/localFirestore.ts') },
    ],
  },
  plugins: [
    react(),
    // Nothing is fetched off-device — including the Google Fonts stylesheet
    // index.html would otherwise load — so strip that block and fall back to
    // system fonts.
    {
      name: 'strip-google-fonts',
      transformIndexHtml(html: string) {
        return html.replace(/<!-- google-fonts:start[\s\S]*?google-fonts:end -->\n?/, '');
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Punch In',
        short_name: 'Punch In',
        description:
          'A single-user life planner covering workouts, learning, chores, finances, meals, health, and goals.',
        theme_color: '#7D4DFE',
        background_color: '#F4F5F0',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // wasm is included so the client-side SQLite engine (sql.js) is
        // precached and available with zero network requests.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    exclude: ['**/node_modules/**', '**/.claude/**', '**/.worktrees/**', '**/worktrees/**', '**/workers/**'],
  },
});
