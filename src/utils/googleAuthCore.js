/**
 * GoogleAuth core — module-scoped OAuth state and GIS TokenClient helpers.
 *
 * Token stored in a module-level variable (never localStorage).
 * Lost on page refresh, requiring re-authorization — per security best practice.
 *
 * Uses the implicit OAuth 2.0 flow via GIS TokenClient.
 * Scopes: calendar.readonly (import) + calendar.events (export).
 *
 * Kept in its own file so googleAuth.jsx only exports the provider component
 * (React Fast Refresh requires component-only files).
 */

// Module-scoped state — survives re-renders, lost on page refresh
let accessToken = null;
let tokenExpiresAt = 0; // epoch ms — implicit-flow tokens live ~1h
let tokenClient = null;
let expiryCallbacks = [];
let gisLoadPromise = null;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

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

// -- Core Auth Functions -------------------------------------------------------

/**
 * Initialize the GIS TokenClient. Call once on app mount.
 * Safe to call when VITE_GOOGLE_CLIENT_ID is unset — does nothing.
 */
export function initGoogleAuth(clientId) {
  if (!clientId || clientId.startsWith('your-')) return;
  waitForGis().then((google) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          console.warn('Google OAuth error:', response.error);
          accessToken = null;
          tokenExpiresAt = 0;
          expiryCallbacks.forEach(cb => cb(response.error));
        } else {
          accessToken = response.access_token;
          // Track expiry so a stale token is never handed out (implicit-flow
          // tokens last ~1h; expires_in is in seconds). 30s safety margin.
          tokenExpiresAt = Date.now() + (response.expires_in || 3599) * 1000 - 30000;
        }
      },
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
 * Trigger the OAuth popup. Returns a Promise that resolves with the token.
 * If already signed in (and the token hasn't expired), returns the existing
 * token immediately. Expired tokens are discarded and re-prompted.
 */
export async function requestAccessToken() {
  if (accessToken) {
    if (Date.now() < tokenExpiresAt) return accessToken;
    // Token expired — clear it and notify so the UI flips to signed-out
    // before we open a fresh consent popup.
    accessToken = null;
    expiryCallbacks.forEach(cb => cb('token_expired'));
  }
  // Wait for the GIS script if it hasn't loaded yet (it may still be
  // in-flight when the user clicks right after mount).
  if (!tokenClient) {
    try { await waitForGis(); } catch { /* tokenClient stays null → error below */ }
  }
  if (!tokenClient) return Promise.reject(new Error('Google sign-in could not be loaded. Check your network connection or ad-blocker.'));

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Sign-in was cancelled or timed out.'));
    }, 60000);

    // Override the callback temporarily to resolve/reject the Promise
    const origCallback = tokenClient.callback;
    tokenClient.callback = (response) => {
      clearTimeout(timeout);
      tokenClient.callback = origCallback; // restore — don't chain closures
      if (origCallback) origCallback(response);
      if (response.error) {
        reject(new Error(response.error === 'access_denied' ? 'Calendar access was denied. Please grant permission.' : response.error));
      } else {
        resolve(response.access_token);
      }
    };

    try {
      tokenClient.requestAccessToken();
    } catch (err) {
      clearTimeout(timeout);
      tokenClient.callback = origCallback;
      reject(err);
    }
  });
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
  expiryCallbacks.forEach(cb => cb('user_signed_out'));
}

/**
 * Single source of truth for whether the Google integration can work.
 * False when the build-time client ID is missing or still the .env.example
 * placeholder — in that case every Google UI element must stay hidden.
 */
export const isGoogleConfigured =
  !!import.meta.env.VITE_GOOGLE_CLIENT_ID &&
  !String(import.meta.env.VITE_GOOGLE_CLIENT_ID).startsWith('your-');

/** Register a callback for when the token expires or is revoked. */
export function onTokenExpired(cb) {
  expiryCallbacks.push(cb);
  return () => { expiryCallbacks = expiryCallbacks.filter(c => c !== cb); };
}
