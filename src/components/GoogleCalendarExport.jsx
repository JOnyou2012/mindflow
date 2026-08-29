import { useState, useCallback, useEffect } from 'react';
import { useGoogleAuth } from '../utils/googleAuthContext.js';
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
export default function GoogleCalendarExport({ weekResults, planVersion, T }) {
  const { isSignedIn, signOut, refreshToken } = useGoogleAuth();
  const [status, setStatus] = useState('idle'); // idle | syncing | synced | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [syncResult, setSyncResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // A regenerated plan means the previously synced sessions no longer exist —
  // "Synced N sessions" would otherwise keep claiming the new plan is in
  // Google Calendar when it was never exported.
  useEffect(() => {
    setStatus('idle');
    setSyncResult(null);
    setErrorMsg(null);
  }, [planVersion]);

  const weekStarts = Object.keys(weekResults).sort();
  const totalSessions = Object.values(weekResults).reduce((sum, r) => {
    if (!r?.days) return sum;
    return sum + Object.values(r.days).reduce((s, d) => s + (d.sessions?.length || 0), 0);
  }, 0);

  const saveTracking = (result) => {
    const existing = loadGoogleExport();
    for (const evt of result.events) {
      const key = evt.weekStart;
      if (!existing[key]) existing[key] = { syncedAt: new Date().toISOString(), events: [] };
      existing[key].events.push(evt);
      existing[key].syncedAt = new Date().toISOString();
    }
    saveGoogleExport(existing);
  };

  const handleExport = useCallback(async () => {
    setErrorMsg(null);
    setProgress({ current: 0, total: totalSessions });

    // Token-on-demand before a write: a missing/expired token must trigger
    // a quiet refresh, not a 401 storm. If even the refresh fails, surface
    // the error but leave the widget in place.
    let token;
    try {
      token = await refreshToken();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || T.gcalExportError.replace('{detail}', ''));
      return;
    }

    setStatus('syncing');
    // Local idempotence: sessions already present in the tracking store are
    // skipped before any API call, on top of the API-side dedup.
    const alreadySyncedKeys = new Set(
      Object.values(loadGoogleExport())
        .flatMap(e => e?.events || [])
        .map(ev => ev?.sessionKey)
        .filter(Boolean),
    );

    const runExport = async (tok) => {
      const result = await exportSessions(tok, weekStarts, weekResults, (current, total) => {
        setProgress({ current, total });
      }, alreadySyncedKeys);
      setSyncResult(result);
      setStatus('synced');
      saveTracking(result);
    };

    try {
      await runExport(token);
    } catch (err) {
      if (err.message === 'token_expired') {
        // One 401: refresh and retry once (export is idempotent — dedup
        // makes a partial export safe to re-run). Never reset the UI to
        // Connect for a single expired token.
        try {
          token = await refreshToken();
          await runExport(token);
        } catch (err2) {
          setStatus('error');
          setErrorMsg(err2.message === 'token_expired'
            ? T.gcalTokenExpired
            : T.gcalExportError.replace('{detail}', err2.message || ''));
        }
      } else if (err.message === 'permission_denied') {
        // The scope was revoked in Google settings — the token is useless
        // for export. Sign out so the next Connect re-requests consent
        // instead of failing forever with the same dead token.
        signOut();
        setStatus('error');
        setErrorMsg(T.gcalPermissionDenied);
      } else {
        setStatus('error');
        setErrorMsg(T.gcalExportError.replace('{detail}', err.message || ''));
      }
    }
  }, [refreshToken, signOut, weekStarts, weekResults, totalSessions, T]);

  const handleUnsync = useCallback(async () => {
    // Destructive Calendar action — confirm first (production feedback:
    // Remove fired silently and deleted events without warning).
    if (!window.confirm(T.gcalUnsyncConfirm)) return;

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

    // Token-on-demand: Remove must not fail on a dead token just because
    // the user last connected a while ago.
    let token;
    try {
      token = await refreshToken();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || T.gcalExportError.replace('{detail}', ''));
      return;
    }

    // A mid-batch 401 refreshes the token once and retries the failing
    // event instead of aborting the whole batch (production Remove bug).
    const runDelete = (tok) => deleteSyncedEvents(tok, allEvents, () => refreshToken());

    const finishSuccess = () => {
      for (const ws of weekStarts) delete exportData[ws];
      saveGoogleExport(exportData);
      setSyncResult(null);
      setStatus('idle');
    };

    try {
      const res = await runDelete(token);
      if (res.failed > 0) {
        // Keep tracking so the user can retry — don't orphan events in
        // Google Calendar by pretending the unsync fully succeeded.
        setStatus('error');
        setErrorMsg(T.gcalExportFailed.replace('{n}', res.failed) + ' ' + T.gcalUnsyncRetry);
        return;
      }
      finishSuccess();
    } catch (err) {
      if (err.message === 'token_expired') {
        try {
          token = await refreshToken();
          const res = await runDelete(token);
          if (res.failed > 0) {
            setStatus('error');
            setErrorMsg(T.gcalExportFailed.replace('{n}', res.failed) + ' ' + T.gcalUnsyncRetry);
            return;
          }
          finishSuccess();
        } catch (err2) {
          setStatus('error');
          setErrorMsg(err2.message === 'token_expired'
            ? T.gcalTokenExpired
            : T.gcalExportError.replace('{detail}', err2.message || ''));
        }
      } else if (err.message === 'permission_denied') {
        signOut();
        setStatus('error');
        setErrorMsg(T.gcalPermissionDenied);
      } else {
        setStatus('error');
        setErrorMsg(T.gcalExportError.replace('{detail}', err.message || ''));
      }
    }
  }, [refreshToken, signOut, weekStarts, T]);

  // Signed-out state (errors take precedence — a failed sign-in leaves
  // isSignedIn false, and swallowing the error here made it invisible)
  if (!isSignedIn && status !== 'syncing' && status !== 'error') {
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
          {skipped > 0 && ' ' + T.gcalExportSkipped.replace('{n}', skipped)}
        </span>
        {failed > 0 && (
          <span className="text-xs text-mindflow-warning">
            {T.gcalExportFailed.replace('{n}', failed)}
          </span>
        )}
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
