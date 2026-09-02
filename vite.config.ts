/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The offline build (`--mode offline`, see package.json's dev:offline /
// build:offline scripts and .env.offline) swaps every `firebase/firestore`
// import for the local SQLite-backed shim in src/localdb/localFirestore.ts,
// so all of src/domains/**Api.ts run against on-device storage unchanged
// and the resulting bundle never talks to Firestore.
//
// Conversely, the default production build (Firebase auth) swaps the local
// SQLite auth modules for tiny stubs, so its bundle doesn't carry sql.js and
// its ~650kB wasm binary for users who never touch the offline provider.
// Scoped to `command === 'build'` so `vitest run` and `vite dev` still
// resolve the real modules (tests exercise them directly).
function resolveTo(path: string) {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig(({ mode, command }) => ({
  resolve: {
    alias:
      mode === 'offline'
        ? [{ find: 'firebase/firestore', replacement: resolveTo('./src/localdb/localFirestore.ts') }]
        : command === 'build'
          ? [
              { find: './localAuth', replacement: resolveTo('./src/auth/localAuth.stub.ts') },
              { find: '../auth/LocalLogin', replacement: resolveTo('./src/auth/LocalLogin.stub.tsx') },
            ]
          : [],
  },
  plugins: [
    react(),
    // The offline build must never fetch anything off-device — including
    // the Google Fonts stylesheet index.html normally loads — so strip that
    // block out and fall back to system fonts.
    mode === 'offline' && {
      name: 'strip-google-fonts-for-offline-build',
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
        // wasm is included so the offline build's client-side SQLite engine
        // (sql.js) is precached and available with zero network requests.
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
}));
