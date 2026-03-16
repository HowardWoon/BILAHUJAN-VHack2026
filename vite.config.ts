import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Support both VITE_GEMINI_API_KEY and the bare GEMINI_API_KEY in .env
  const geminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
  const mapsKey   = env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Warn early in both dev and build if required keys are absent
  if (!geminiKey)  console.warn('[vite] ⚠️  VITE_GEMINI_API_KEY is not set — AI features will not work.');
  if (!mapsKey)    console.warn('[vite] ⚠️  VITE_GOOGLE_MAPS_API_KEY is not set — Maps will not load.');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Expose keys via process.env for any non-import.meta.env code paths
      'process.env.GEMINI_API_KEY':           JSON.stringify(geminiKey),
      'process.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(mapsKey),
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-firebase': ['firebase/app', 'firebase/analytics', 'firebase/database', 'firebase/firestore'],
            'vendor-maps':     ['@react-google-maps/api'],
            'vendor-ai':       ['@google/genai'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
