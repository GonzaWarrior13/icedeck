import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const standalone = mode === 'rinkbeats' || process.env.VERCEL === '1'
    || process.env.VITE_ICEDECK_STANDALONE === 'true';

  return {
    define: standalone ? { 'import.meta.env.VITE_ICEDECK_STANDALONE': JSON.stringify('true') } : {},
    // Base44 previously supplied this alias. Standalone Supabase builds need it too.
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      ...(standalone ? [] : [base44({
        // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
        // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: true,
        navigationNotifier: true,
        analyticsTracker: true,
        visualEditAgent: true
      })]),
      react(),
    ]
  };
});
