/**
 * GoogleAuth — React provider wrapping the app root.
 *
 * Token stored in a module-level variable (never localStorage).
 * Lost on page refresh, requiring re-authorization — per security best practice.
 *
 * Uses the implicit OAuth 2.0 flow via GIS TokenClient.
 * Scopes: calendar.readonly (import) + calendar.events (export).
 */

import { useState, useEffect, useCallback } from 'react';
import { GoogleAuthContext } from './googleAuthContext.js';
import {
  initGoogleAuth,
  getAccessToken,
  isSignedIn,
  requestAccessToken,
  clearToken,
  onTokenExpired,
} from './googleAuthCore.js';
import { clearGoogleCache, clearGoogleCalendars } from './storage.js';

/**
 * Provider — wrap the app root. If VITE_GOOGLE_CLIENT_ID is unset,
 * children render normally with isSignedIn=false (Google features hidden).
 */
export function GoogleAuthProvider({ clientId, children }) {
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId || clientId.startsWith('your-')) return;
    initGoogleAuth(clientId);

    const unsub = onTokenExpired((reason) => {
      setSignedIn(false);
      if (reason !== 'user_signed_out') setError(reason);
    });

    return unsub;
  }, [clientId]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await requestAccessToken();
      setSignedIn(true);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setSignedIn(false);
    // PRD step 94: sign-out clears all cached calendar data (imported
    // events + calendar selection). Export tracking deliberately survives —
    // the user may re-connect and still need to unsync previously created
    // events; clearing it would orphan them in Google Calendar.
    clearGoogleCache();
    clearGoogleCalendars();
  }, []);

  const value = {
    isSignedIn: signedIn || isSignedIn(),
    signIn,
    signOut,
    getToken: getAccessToken,
    error,
  };

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  );
}
