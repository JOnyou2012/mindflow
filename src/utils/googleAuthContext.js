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
  signOut: () => {},
  getToken: () => null,
});

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}

export { GoogleAuthContext };
