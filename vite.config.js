import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Build stamp — last commit hash + commit time (UTC), shown as a small
// footer watermark so a deployed build can be matched to git at a glance.
function buildStamp() {
  try {
    const line = execSync('git log -1 --format="%h|%cI"', { encoding: 'utf8' }).trim();
    const [hash, iso] = line.split('|');
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${hash} · ${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  } catch {
    return 'dev build';
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Inject the build stamp as a compile-time constant (Vite define).
  define: { __BUILD_STAMP__: JSON.stringify(buildStamp()) },
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
