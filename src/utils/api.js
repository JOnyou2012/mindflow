/**
 * API client — auto-selects the right backend URL for the environment.
 *
 *   - `npm run dev`   → Vite proxy forwards /api → localhost:8000
 *   - `npm run build` → calls the deployed Render backend
 *
 * Set VITE_API_ORIGIN in your Netlify/Render env vars to the backend URL,
 * e.g. https://mindflow-api.onrender.com
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
