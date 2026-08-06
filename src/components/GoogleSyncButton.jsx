import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, LogOut, AlertCircle } from 'lucide-react';

export default function GoogleSyncButton({ onSync, syncStatus, onSignOut }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await onSync();
    } catch (err) {
      setError(err.message || 'Sync failed');
    }
    setLoading(false);
  }, [onSync]);

  // Not connected
  if (!syncStatus.connected) {
    return (
      <div className="space-y-2">
        <button
          onClick={handleSync}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                     bg-white text-gray-900 hover:bg-gray-100 transition-colors
                     disabled:opacity-50 shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Connecting...' : 'Connect Google Calendar'}
        </button>
        {error && (
          <div className="flex items-center gap-1 text-xs text-mindflow-danger">
            <AlertCircle className="w-3 h-3" />{error}
          </div>
        )}
      </div>
    );
  }

  // Connected
  const minsAgo = syncStatus.lastSync
    ? Math.round((Date.now() - syncStatus.lastSync) / 60000)
    : null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2 h-2 rounded-full bg-mindflow-success" />
        <span className="text-mindflow-muted">
          {syncStatus.blockCount || 0} events synced
          {minsAgo !== null && minsAgo < 60 && ` · ${minsAgo === 0 ? 'just now' : minsAgo + 'm ago'}`}
        </span>
      </div>
      <button
        onClick={handleSync}
        disabled={loading}
        className="p-1.5 rounded-lg text-mindflow-muted hover:text-mindflow-text hover:bg-mindflow-bg transition-colors"
        title="Refresh"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      </button>
      <button
        onClick={onSignOut}
        className="p-1.5 rounded-lg text-mindflow-muted hover:text-mindflow-danger hover:bg-mindflow-danger/10 transition-colors"
        title="Disconnect"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
      {error && (
        <span className="text-xs text-mindflow-danger flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{error}
        </span>
      )}
    </div>
  );
}
