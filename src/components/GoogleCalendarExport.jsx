import { useState, useCallback } from 'react';
import { useGoogleAuth } from '../utils/googleAuth.jsx';
import { exportSessions, deleteSyncedEvents } from '../utils/googleCalendar.js';
import { saveGoogleExport, loadGoogleExport } from '../utils/storage.js';

/**
 * Export widget — renders in Step 4 (plan) toolbar to sync generated
 * study sessions to Google Calendar. Syncs ALL generated weeks at once.
 *
 * Props:
 *   weekResults   { [weekStartISO]: OptimizedWeek }
 *   T             translations
 */
export default function GoogleCalendarExport({ weekResults, T }) {
  const { isSignedIn, signIn, getToken } = useGoogleAuth();
  const [status, setStatus] = useState('idle'); // idle | syncing | synced | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [syncResult, setSyncResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const weekStarts = Object.keys(weekResults).sort();
  const totalSessions = Object.values(weekResults).reduce((sum, r) => {
    if (!r?.days) return sum;
    return sum + Object.values(r.days).reduce((s, d) => s + (d.sessions?.length || 0), 0);
  }, 0);

  const handleExport = useCallback(async () => {
    if (!isSignedIn) {
      try { await signIn(); } catch { return; }
    }

    const token = getToken();
    if (!token) return;

    setStatus('syncing');
    setErrorMsg(null);
    setProgress({ current: 0, total: totalSessions });

    try {
      // Track progress per-event via polling the export function
      const result = await exportSessions(token, weekStarts, weekResults);
      setSyncResult(result);
      setStatus('synced');

      // Save export tracking
      const existing = loadGoogleExport();
      for (const evt of result.events) {
        const key = evt.weekStart;
        if (!existing[key]) existing[key] = { syncedAt: new Date().toISOString(), events: [] };
        existing[key].events.push(evt);
        existing[key].syncedAt = new Date().toISOString();
      }
      saveGoogleExport(existing);
    } catch (err) {
      setStatus('error');
      if (err.message === 'token_expired') {
        setErrorMsg(T.gcalTokenExpired);
      } else if (err.message === 'permission_denied') {
        setErrorMsg(T.gcalPermissionDenied);
      } else {
        setErrorMsg(T.gcalExportError.replace('{detail}', err.message || ''));
      }
    }
  }, [isSignedIn, signIn, getToken, weekStarts, weekResults, totalSessions, T]);

  const handleUnsync = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setStatus('syncing');
    const exportData = loadGoogleExport();
    const allEvents = weekStarts.reduce((arr, ws) => {
      if (exportData[ws]?.events) arr.push(...exportData[ws].events);
      return arr;
    }, []);

    if (allEvents.length === 0) {
      setStatus('idle');
      return;
    }

    try {
      await deleteSyncedEvents(token, allEvents);
      // Clear tracking for these weeks
      for (const ws of weekStarts) delete exportData[ws];
      saveGoogleExport(exportData);
      setSyncResult(null);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      if (err.message === 'token_expired') setErrorMsg(T.gcalTokenExpired);
      else setErrorMsg(T.gcalExportError.replace('{detail}', err.message || ''));
    }
  }, [getToken, weekStarts, T]);

  // Signed-out state
  if (!isSignedIn && status !== 'syncing') {
    return (
      <button
        type="button"
        onClick={handleExport}
        className="rounded-full border border-mindflow-border px-4 py-1.5 text-sm font-medium text-mindflow-text hover:bg-mindflow-surface-alt flex items-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {T.gcalExport}
      </button>
    );
  }

  // Syncing state
  if (status === 'syncing') {
    return (
      <button disabled className="rounded-full bg-mindflow-accent px-4 py-1.5 text-sm font-medium text-mindflow-onaccent opacity-60 flex items-center gap-2">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {progress.total > 0
          ? T.gcalExportProgress.replace('{current}', progress.current).replace('{total}', progress.total)
          : T.gcalExportSync}
      </button>
    );
  }

  // Synced state
  if (status === 'synced' && syncResult) {
    const { created, skipped, failed } = syncResult;
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-mindflow-success">
          {T.gcalExportSuccess.replace('{n}', created)}
          {skipped > 0 && ` (${skipped} skipped)`}
        </span>
        <button type="button" onClick={handleExport} className="text-xs text-mindflow-accent hover:underline">{T.gcalRefresh}</button>
        <button type="button" onClick={handleUnsync} className="text-xs text-mindflow-muted hover:text-mindflow-danger">{T.gcalUnsync}</button>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-mindflow-danger">{errorMsg}</span>
        <button type="button" onClick={handleExport} className="text-xs text-mindflow-accent hover:underline">{T.gcalConnect}</button>
      </div>
    );
  }

  // Idle + signed in
  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={totalSessions === 0}
      className="rounded-full bg-mindflow-accent px-4 py-1.5 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="white"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
      </svg>
      {T.gcalExport}
    </button>
  );
}
