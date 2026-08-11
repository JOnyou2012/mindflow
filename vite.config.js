import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Target ES2019 so optional chaining (?. ) and nullish coalescing (??)
  // are transpiled for older browsers (Safari <13.4, Chrome <80).
  // Students may have older devices; this costs ~2KB extra gzip.
  build: { target: 'es2019' },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
