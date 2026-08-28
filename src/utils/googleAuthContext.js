/**
 * GoogleAuth context + hook.
 *
 * Kept separate from the provider component (googleAuth.jsx) so each file
 * exports a single kind of thing (React Fast Refresh requirement).
 */

import { createContext, useContext } from 'react';

const GoogleAuthContext = createContext({
  isSignedIn: false,
  signIn: () => Promise.reject(new Error('Not initialized')),
  // Token-on-demand: silent session reuse first, interactive popup as
  // fallback. Use before Calendar writes so a dead token never reaches
  // the API — a 401 mid-write should retry, not reset the UI.
  refreshToken: () => Promise.reject(new Error('Not initialized')),
  signOut: () => {},
  getToken: () => null,
});

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}

export { GoogleAuthContext };
