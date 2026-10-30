import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works at https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // Libraries change far less often than the app, so they get their own long-lived files:
        // after a deploy, phones only re-download the app code.
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
})
