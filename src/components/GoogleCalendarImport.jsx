import { useState, useCallback } from 'react';
import { useGoogleAuth } from '../utils/googleAuthContext.js';
import { fetchWeekEvents, fetchCalendarList } from '../utils/googleCalendar.js';
import { saveGoogleCache, saveGoogleCalendars, loadGoogleCalendars } from '../utils/storage.js';
import { getStoredLang, langToLocale } from '../utils/i18n.js';
import GoogleSyncButton from './GoogleSyncButton.jsx';

// Small inline Google "G" mark — mirrors the lucide-free SVGs used in
// GoogleSyncButton so the import widget stays dependency-consistent.
function GLogo({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/**
 * Import widget — renders in Step 2 (schedule) to pull Google Calendar
 * events into MindFlow as fixed blocks.
 *
 * Multi-calendar (PRD step 91): once connected, the user sees their
 * readable calendars with toggle checkboxes + color dots. The selection
 * persists to localStorage; toggling re-syncs immediately.
 *
 * Props:
 *   weekStart      ISO Monday date string
 *   onImport       (blocks: CalendarBlock[]) => void
 *   onError        (message: string) => void
 *   T              translations
 */
export default function GoogleCalendarImport({ weekStart, onImport, onError, T }) {
  const { isSignedIn, getToken, signOut } = useGoogleAuth();
  const [calendars, setCalendars] = useState(null); // calendar list, null = not loaded
  const [selectedIds, setSelectedIds] = useState(() => loadGoogleCalendars());
  const [syncInfo, setSyncInfo] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [listError, setListError] = useState(null);

  /**
   * Saved selection ∩ current list; falls back to the primary calendar
   * when nothing valid was saved (first connect, or every saved calendar
   * was deleted since).
   */
  const resolveSelection = useCallback((calList) => {
    const listIds = calList.map(c => c.id);
    const intersect = selectedIds.filter(id => listIds.includes(id));
    if (intersect.length > 0) return intersect;
    const fallback = calList.find(c => c.primary) || calList[0];
    return fallback ? [fallback.id] : [];
  }, [selectedIds]);

  const handleSync = useCallback(async (idsOverride = null) => {
    const token = getToken();
    if (!token) {
      // Token was cleared elsewhere (e.g. sign-out via the export widget)
      // while imported blocks were showing — fall back to the Connect
      // button instead of a silent no-op.
      setSyncInfo(null);
      return;
    }
    setSyncing(true);
    setListError(null);
    try {
      // Load the calendar list once per session (per connect) — it feeds
      // both the picker UI and the per-calendar block coloring.
      let calList = calendars;
      if (!calList) {
        try {
          calList = await fetchCalendarList(token);
        } catch (err) {
          if (err.message === 'token_expired') {
            signOut();
            onError?.(T.gcalTokenExpired);
            return;
          }
          if (err.message === 'permission_denied') { onError?.(T.gcalPermissionDenied); return; }
          if (err.message === 'rate_limited') { onError?.(T.gcalRateLimited); return; }
          setListError(T.gcalCalendarsError);
          return;
        }
        setCalendars(calList);
      }

      const ids = idsOverride || resolveSelection(calList);
      saveGoogleCalendars(ids);
      setSelectedIds(ids);

      if (ids.length === 0) {
        // All calendars toggled off — clear the grid, keep the picker open.
        const syncedAt = new Date().toISOString();
        setSyncInfo({ eventCount: 0, calendarNames: [], failures: 0, syncedAt });
        saveGoogleCache({ data: [], syncedAt, weekStart, calendarNames: [], eventCount: 0 });
        onImport([]);
        return;
      }

      const { blocks, eventCount, calendarNames, failures } = await fetchWeekEvents(token, weekStart, ids, calList);
      const syncedAt = new Date().toISOString();
      setSyncInfo({ eventCount, calendarNames, failures, syncedAt });
      saveGoogleCache({ data: blocks, syncedAt, weekStart, calendarNames, eventCount });
      if (onImport) onImport(blocks);
    } catch (err) {
      if (err.message === 'token_expired') {
        // Clear the dead token so the next Connect opens a fresh popup.
        signOut();
        onError?.(T.gcalTokenExpired);
      } else if (err.message === 'permission_denied') {
        onError?.(T.gcalPermissionDenied);
      } else if (err.message === 'rate_limited') {
        onError?.(T.gcalRateLimited);
      } else {
        onError?.(T.gcalImportError);
      }
    } finally {
      setSyncing(false);
    }
  }, [getToken, signOut, calendars, resolveSelection, weekStart, onImport, onError, T]);

  const toggleCalendar = (id) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    saveGoogleCalendars(next);
    setSelectedIds(next);
    // Live re-sync when a toggle changes an already-synced week — instant
    // feedback instead of making the user hunt for a refresh button.
    if (syncInfo) handleSync(next);
  };

  const handleSignOut = () => {
    signOut(); // provider clears token + cached calendar data
    setSyncInfo(null);
    setCalendars(null);
    setSelectedIds([]);
    setListError(null);
    onImport?.([]);
  };

  if (!isSignedIn) {
    return <GoogleSyncButton onSync={handleSync} onError={onError} T={T} />;
  }

  const syncedAtLabel = syncInfo?.syncedAt
    ? new Date(syncInfo.syncedAt).toLocaleTimeString(langToLocale(getStoredLang()), { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-2">
      {/* Connected status row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5">
          <GLogo className="w-3.5 h-3.5 shrink-0" />
          <span className="text-mindflow-success font-medium">{T.gcalConnected}</span>
        </span>
        {syncedAtLabel && !syncing && (
          <span className="text-mindflow-muted">{T.gcalLastSync}: {syncedAtLabel}</span>
        )}
        <button type="button" onClick={() => handleSync()} disabled={syncing}
          className="text-mindflow-accent hover:underline disabled:opacity-40">{T.gcalRefresh}</button>
        <button type="button" onClick={handleSignOut}
          className="text-mindflow-muted hover:text-mindflow-danger">{T.gcalSignOut}</button>
      </div>

      {/* Calendar picker */}
      {calendars === null && !listError ? (
        <p className="text-xs text-mindflow-muted flex items-center gap-2">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {T.gcalCalendarsLoading}
        </p>
      ) : listError ? (
        <p className="text-xs text-mindflow-danger">
          {listError}
          <button type="button" onClick={() => handleSync()} className="text-mindflow-accent hover:underline ms-1">{T.gcalRefresh}</button>
        </p>
      ) : calendars.length === 0 ? (
        <p className="text-xs text-mindflow-muted">{T.gcalCalendarsNone}</p>
      ) : (
        <div className="rounded-lg border border-mindflow-border bg-mindflow-surface p-3 max-h-48 overflow-y-auto">
          <p className="text-[11px] font-medium uppercase tracking-wide text-mindflow-muted mb-2">{T.gcalCalendarsTitle}</p>
          <ul className="space-y-1">
            {calendars.map(c => (
              <li key={c.id}>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-mindflow-text py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleCalendar(c.id)}
                    disabled={syncing}
                    className="w-3.5 h-3.5 shrink-0 cursor-pointer"
                  />
                  <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: c.backgroundColor || '#4285F4' }} />
                  <span className="truncate">{c.summary}</span>
                  {c.primary && <span className="text-[10px] text-mindflow-muted shrink-0">({T.gcalPrimaryCalendar})</span>}
                </label>
              </li>
            ))}
          </ul>
          {syncing && (
            <p className="text-xs text-mindflow-muted mt-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {T.gcalConnecting}
            </p>
          )}
        </div>
      )}

      {/* Sync result */}
      {syncInfo && !syncing && (
        <p className="text-xs text-mindflow-success">
          {syncInfo.calendarNames.length > 0
            ? T.gcalImportSuccess.replace('{n}', syncInfo.eventCount).replace('{calendar}', syncInfo.calendarNames.join(', '))
            : T.gcalCalendarsNoneSelected}
          {syncInfo.failures > 0 && (
            <span className="text-mindflow-warning"> {T.gcalCalendarsFailures.replace('{n}', syncInfo.failures)}</span>
          )}
        </p>
      )}
    </div>
  );
}
