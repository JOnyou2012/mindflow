/**
 * API client — auto-selects the right backend URL for the environment.
 *
 *   - `npm run dev`   → Vite proxy forwards /api → localhost:8000
 *   - `npm run build` → calls the deployed Render backend
 *
 * ## When to use
 *
 * The MindFlow frontend runs **entirely client-side** — the Markov engine
 * (`markovEngine.js`) and scheduler (`scheduler.js`) execute in the browser.
 * The Python backend (`backend/main.py`) is an optional mirror: it exposes
 * the same simulation endpoints for server-side computation.
 *
 * If you want to offload simulation work to the server (e.g. for heavier
 * workloads or to keep the Python math in sync), import `api()` in any
 * component and replace the local JS calls:
 *
 * ```js
 * import { api } from '../utils/api.js';
 * const result = await api('/api/simulate', { alpha: 1.0, beta: 3.0, ... });
 * ```
 *
 * **Without importing this module**, the app is fully self-contained —
 * everything runs in the browser via the JS engine.  The backend is
 * optional infrastructure.
 *
 * ## Configuration
 *
 * Set VITE_API_ORIGIN in your Netlify/Render env vars to the backend URL,
 * e.g. https://mindflow-api.onrender.com.  In dev mode the empty-string
 * default uses Vite's proxy; in production the fallback below kicks in if
 * no env var is set.
 *
 * @module api
 */

const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN ||
  (import.meta.env.DEV ? '' : 'https://mindflow-api.onrender.com');

/**
 * Call a MindFlow API endpoint (GET or POST).
 *
 * @param {string} path    API path, e.g. '/api/simulate'
 * @param {object} [body]  Optional JSON body — forces POST when present
 * @returns {Promise<object>} Parsed JSON response
 */
export async function api(path, body = undefined) {
  const url = API_ORIGIN + path;
  const init = {
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    init.method = 'POST';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}
