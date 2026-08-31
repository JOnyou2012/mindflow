/**
 * GoogleAuth core — module-scoped OAuth state and GIS TokenClient helpers.
 *
 * Token stored in a module-level variable (never localStorage).
 * Lost on page refresh, requiring re-authorization — per security best practice.
 *
 * Uses the implicit OAuth 2.0 flow via GIS TokenClient.
 * Scopes: calendar.readonly (import) + calendar.events (export).
 *
 * Two TokenClient instances:
 * - interactive (default prompt) — account chooser + consent
 * - silent (prompt: '') — reuses the existing session without a chooser,
 *   used by getFreshToken() for token-on-demand before Sync/Remove/delete.
 *
 * Kept in its own file so googleAuth.jsx only exports the provider component
 * (React Fast Refresh requires component-only files).
 */

// Module-scoped state — survives re-renders, lost on page refresh
let accessToken = null;
let tokenExpiresAt = 0; // epoch ms — implicit-flow tokens live ~1h
let tokenClient = null;
let silentTokenClient = null;
let tokenListeners = [];
let gisLoadPromise = null;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

// The interactive popup can legitimately sit open for minutes (account
// chooser + 2FA + consent). NO timeout at all: GIS guarantees the callback
// fires, and any timer we add can only misfire mid-2FA and report
// "cancelled or timed out" while the popup is still open (the exact
// production bug this file previously caused). Only the invisible silent
// client keeps a timeout — there a stuck request must not hang forever.
const SILENT_TIMEOUT_MS = 30 * 1000;

// -- GIS Script Loading --------------------------------------------------------

function waitForGis() {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve(window.google);
    let waited = 0;
    const check = () => {
      waited += 100;
      if (window.google?.accounts?.oauth2) return resolve(window.google);
      if (waited > 15000) return reject(new Error('Google Identity Services failed to load. Check your ad-blocker or network.'));
      setTimeout(check, 100);
    };
    check();
  });
  // Don't cache a rejection — a transient failure (slow network, ad-blocker
  // timing) would otherwise brick sign-in for the whole session.
  return gisLoadPromise.catch((err) => { gisLoadPromise = null; throw err; });
}

// -- Token State ---------------------------------------------------------------

/**
 * Shared response handler. On success stores the token + notifies listeners
 * so the provider flips to signed-in (including after a silent refresh).
 * On error: the silent client must stay quiet (a failed background refresh
 * must not yank the UI to signed-out mid-flow) — only the interactive
 * client clears state and notifies.
 */
function handleTokenResponse(response, silent = false) {
  if (response.error) {
    if (!silent) {
      accessToken = null;
      tokenExpiresAt = 0;
      tokenListeners.forEach(cb => cb(response.error));
    }
  } else {
    accessToken = response.access_token;
    // Track expiry so a stale token is never handed out (implicit-flow
    // tokens last ~1h; expires_in is in seconds). 30s safety margin.
    tokenExpiresAt = Date.now() + (response.expires_in || 3599) * 1000 - 30000;
    tokenListeners.forEach(cb => cb('token_acquired'));
  }
}

/**
 * Wrap a TokenClient's callback in a Promise. The persistent callback stays
 * in place (restored on settle) so state updates still flow through
 * handleTokenResponse regardless of which caller requested the token.
 *
 * timeoutMs: null = wait for the GIS callback only (interactive — the
 * popup owns its lifecycle); a number = safety timeout (silent client).
 */
function requestFromClient(client, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const origCallback = client.callback;
    const timer = timeoutMs === null || timeoutMs === undefined
      ? null
      : setTimeout(() => {
        if (settled) return;
        settled = true;
        client.callback = origCallback;
        reject(new Error('Sign-in was cancelled or timed out.'));
      }, timeoutMs);

    client.callback = (response) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      client.callback = origCallback; // restore — don't chain closures
      if (origCallback) origCallback(response);
      if (response.error) reject(new Error(response.error));
      else resolve(response.access_token);
    };

    try {
      client.requestAccessToken();
    } catch (err) {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      client.callback = origCallback;
      reject(err);
    }
  });
}

/** Map a GIS error code to something the user can act on. */
function friendlyError(code) {
  if (code === 'access_denied') return new Error('Calendar access was denied. Please grant permission.');
  if (code === 'popup_blocked') return new Error('The Google sign-in popup was blocked. Please allow popups for this site.');
  if (code === 'popup_closed' || code === 'user_cancelled') return new Error('Sign-in was cancelled.');
  return new Error(code || 'Google sign-in failed.');
}

// -- Core Auth Functions -------------------------------------------------------

// In-flight guards: concurrent token requests share one underlying GIS
// request (each TokenClient has a single callback slot).
let inFlightInteractiveRequest = null;
let inFlightFreshToken = null;

/**
 * Initialize both GIS TokenClients. Call once on app mount.
 * Safe to call when VITE_GOOGLE_CLIENT_ID is unset — does nothing.
 */
export function initGoogleAuth(clientId) {
  if (!clientId || clientId.startsWith('your-')) return;
  waitForGis().then((google) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => handleTokenResponse(response, false),
    });
    // prompt: '' skips the account chooser when a session exists — the
    // silent refresh path. No visible UI change on failure (handled by
    // getFreshToken falling back to the interactive client).
    silentTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      prompt: '',
      callback: (response) => handleTokenResponse(response, true),
    });
  }).catch(err => console.warn('GoogleAuth init failed:', err));
}

/** Returns the current access token, or null if not signed in. */
export function getAccessToken() {
  return accessToken;
}

/** Returns true if a token is present. */
export function isSignedIn() {
  return accessToken !== null;
}

/**
 * Interactive sign-in. If a valid token exists it is returned immediately.
 * An expired token is cleared and a fresh popup is opened; only if that
 * re-auth FAILS is the UI notified (a successful refresh must never flash
 * the app through a signed-out state).
 *
 * A dismissed/raced popup (popup_closed) retries once automatically —
 * the account chooser can dismiss the first popup before GIS finishes
 * wiring up the callback.
 */
export async function requestAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;

  // Serialize: requestFromClient swaps the TokenClient's single callback
  // slot, so two concurrent callers clobbered each other's wrapper and
  // could mis-resolve or hang (production bug, 2026-08-31). Concurrent
  // callers await the same in-flight request.
  if (inFlightInteractiveRequest) return inFlightInteractiveRequest;
  inFlightInteractiveRequest = (async () => {
    const hadToken = accessToken !== null;
    accessToken = null; // clear silently — re-auth is about to run
    tokenExpiresAt = 0;

    if (!tokenClient) {
      try { await waitForGis(); } catch { /* tokenClient stays null → error below */ }
    }
    if (!tokenClient) throw new Error('Google sign-in could not be loaded. Check your network connection or ad-blocker.');

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await requestFromClient(tokenClient, null); // no timeout — wait for the GIS callback
      } catch (err) {
        if (err.message === 'popup_closed' && attempt === 0) continue; // auto-retry once
        if (hadToken) tokenListeners.forEach(cb => cb('token_expired')); // surface only after refresh failed
        throw friendlyError(err.message);
      }
    }
  })();
  try {
    return await inFlightInteractiveRequest;
  } finally {
    inFlightInteractiveRequest = null;
  }
}

/**
 * Token-on-demand: return a valid token, or obtain one quietly.
 * Silent session reuse first (no popup); falls back to the interactive
 * consent popup. Call before every Calendar write (Sync/Remove/delete).
 */
export async function getFreshToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  // Same serialization as requestAccessToken: the silent client also has
  // one callback slot, and a poll + PATCH landing together used to swap
  // wrappers mid-flight.
  if (inFlightFreshToken) return inFlightFreshToken;
  inFlightFreshToken = (async () => {
    if (silentTokenClient) {
      try {
        return await requestFromClient(silentTokenClient, SILENT_TIMEOUT_MS);
      } catch { /* session gone or consent needed — fall through to interactive */ }
    }
    return requestAccessToken();
  })();
  try {
    return await inFlightFreshToken;
  } finally {
    inFlightFreshToken = null;
  }
}

/** Revoke the token and clear module state. */
export function clearToken() {
  if (accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(accessToken);
    } catch { /* best effort */ }
  }
  accessToken = null;
  tokenExpiresAt = 0;
  tokenListeners.forEach(cb => cb('user_signed_out'));
}

/**
 * Single source of truth for whether the Google integration can work.
 * False when the build-time client ID is missing or still the .env.example
 * placeholder — in that case every Google UI element must stay hidden.
 */
export const isGoogleConfigured =
  !!import.meta.env.VITE_GOOGLE_CLIENT_ID &&
  !String(import.meta.env.VITE_GOOGLE_CLIENT_ID).startsWith('your-');

/**
 * Register a callback for token lifecycle events:
 * 'token_acquired' | 'token_expired' | 'user_signed_out' | GIS error codes.
 */
export function onTokenChange(cb) {
  tokenListeners.push(cb);
  return () => { tokenListeners = tokenListeners.filter(c => c !== cb); };
}
