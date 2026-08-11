import { useState, useCallback } from 'react';
import { useGoogleAuth } from '../utils/googleAuth.jsx';
import { fetchWeekEvents } from '../utils/googleCalendar.js';
import { saveGoogleCache } from '../utils/storage.js';
import GoogleSyncButton from './GoogleSyncButton.jsx';

/**
 * Import widget — renders in Step 2 (schedule) to pull Google Calendar
 * events into MindFlow as fixed blocks.
 *
 * Props:
 *   weekStart      ISO Monday date string
 *   onImport       (blocks: CalendarBlock[]) => void
 *   onError        (message: string) => void
 *   T              translations
 */
export default function GoogleCalendarImport({ weekStart, onImport, onError, T }) {
  const { getToken } = useGoogleAuth();
  const [syncInfo, setSyncInfo] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setSyncing(true);
    try {
      const { blocks, eventCount, calendarName } = await fetchWeekEvents(token, weekStart);
      setSyncInfo({ eventCount, calendarName, syncedAt: new Date().toISOString() });
      saveGoogleCache({ data: blocks, syncedAt: new Date().toISOString(), weekStart, calendarName, eventCount });
      if (onImport) onImport(blocks);
    } catch (err) {
      if (err.message === 'token_expired') {
        onError?.(T.gcalTokenExpired);
      } else if (err.message === 'permission_denied') {
        onError?.(T.gcalPermissionDenied);
      } else {
        onError?.(T.gcalImportError);
      }
    } finally {
      setSyncing(false);
    }
  }, [getToken, weekStart, onImport, onError, T]);

  if (syncing) {
    return (
      <div className="flex items-center gap-2 text-sm text-mindflow-muted">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {T.gcalConnecting}
      </div>
    );
  }

  if (syncInfo) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="text-mindflow-success font-medium">
            {T.gcalImportSuccess.replace('{n}', syncInfo.eventCount).replace('{calendar}', syncInfo.calendarName)}
          </span>
        </div>
        <button type="button" onClick={handleSync} className="text-xs text-mindflow-accent hover:underline">{T.gcalRefresh}</button>
      </div>
    );
  }

  return <GoogleSyncButton onSync={handleSync} onError={onError} T={T} />;
}
