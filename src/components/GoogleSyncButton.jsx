import { useEffect, useState } from 'react';
import { useGoogleAuth } from '../utils/googleAuthContext.js';

/**
 * Reusable Google sign-in / sync button with four states:
 * signed-out → connecting → signed-in → error
 */
export default function GoogleSyncButton({ onSync, onError, T }) {
  const { isSignedIn, signIn, signOut } = useGoogleAuth();
  const [status, setStatus] = useState(isSignedIn ? 'signed-in' : 'signed-out');
  const [errorMsg, setErrorMsg] = useState(null);

  // Follow the context: when the token expires elsewhere (e.g. an import
  // call signs out on 401), the button must flip back to signed-out so the
  // user can re-connect instead of staring at a dead "Connected" state.
  useEffect(() => {
    setStatus(isSignedIn ? 'signed-in' : 'signed-out');
  }, [isSignedIn]);

  const handleSignIn = async () => {
    setStatus('connecting');
    setErrorMsg(null);
    try {
      await signIn();
      setStatus('signed-in');
      if (onSync) onSync();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || T.gcalUnknownError);
      if (onError) onError(err.message);
    }
  };

  const handleSignOut = () => {
    signOut();
    setStatus('signed-out');
  };

  if (status === 'connecting') {
    return (
      <button disabled className="rounded-full bg-mindflow-accent px-4 py-1.5 text-sm font-medium text-mindflow-onaccent opacity-60 flex items-center gap-2">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {T.gcalConnecting}
      </button>
    );
  }

  if (status === 'signed-in') {
    return (
      <div className="flex items-center gap-2 text-xs text-mindflow-muted">
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span className="text-mindflow-success font-medium">{T.gcalConnected}</span>
        <button type="button" onClick={onSync} className="text-mindflow-accent hover:underline">{T.gcalRefresh}</button>
        <button type="button" onClick={handleSignOut} className="text-mindflow-muted hover:text-mindflow-danger">{T.gcalSignOut}</button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-mindflow-danger">{errorMsg}</span>
        <button type="button" onClick={handleSignIn} className="text-xs text-mindflow-accent hover:underline">{T.gcalConnect}</button>
      </div>
    );
  }

  // signed-out
  return (
    <button
      type="button"
      onClick={handleSignIn}
      className="rounded-full border border-mindflow-border px-4 py-1.5 text-sm font-medium text-mindflow-text hover:bg-mindflow-surface-alt flex items-center gap-2"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {T.gcalConnect}
    </button>
  );
}
