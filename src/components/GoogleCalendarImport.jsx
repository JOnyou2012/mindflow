import { useGoogleAuth } from '../utils/googleAuthContext.js';
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
 * Import widget — renders in Step 2 (schedule).
 *
 * PRESENTATIONAL ONLY: all sync state lives in App so the two-way-sync
 * poll/focus refresh keeps running on every step (this widget unmounts
 * on Plan — keeping the state here killed inbound sync).
 *
 * Props:
 *   gCalendars / gSelectedIds / gSyncInfo / gSyncing / gListError
 *     App-owned Google sync state
 *   onGoogleSync          () => void — the shared refresh (Refresh link)
 *   onGoogleToggleCalendar(id)        — checkbox toggles
 *   onGoogleSignOut       () => void  — clear App-side Google state
 *   T                     translations
 */
export default function GoogleCalendarImport({
  gCalendars: calendars,
  gSelectedIds: selectedIds,
  gSyncInfo: syncInfo,
  gSyncing: syncing,
  gListError: listError,
  onGoogleSync,
  onGoogleToggleCalendar,
  onGoogleSignOut,
  T,
}) {
  const { isSignedIn, signOut } = useGoogleAuth();

  if (!isSignedIn) {
    return <GoogleSyncButton onSync={onGoogleSync} T={T} />;
  }

  // Last synced in the CALENDAR's zone (not the machine's — a Pacific
  // browser clock confused testers) and with seconds so every completed
  // refresh is visibly newer.
  const syncedAtLabel = syncInfo?.syncedAt
    ? new Date(syncInfo.syncedAt).toLocaleTimeString(langToLocale(getStoredLang()), {
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      timeZone: syncInfo.timeZone || undefined,
    })
    : null;

  const handleSignOut = () => {
    signOut(); // provider clears token + cached calendar data
    onGoogleSignOut();
  };

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
        <button type="button" onClick={onGoogleSync} disabled={syncing}
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
          <button type="button" onClick={onGoogleSync} className="text-mindflow-accent hover:underline ms-1">{T.gcalRefresh}</button>
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
                    onChange={() => onGoogleToggleCalendar(c.id)}
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
