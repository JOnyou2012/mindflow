import { Component } from 'react';
import { clearAll } from '../utils/storage.js';

/**
 * ErrorBoundary — catches unhandled render exceptions to prevent
 * a white screen. Shows a "Something went wrong" fallback with a
 * reload button.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MindFlow unhandled error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-mindflow-bg flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 rounded-full bg-mindflow-danger/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-mindflow-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-xl font-normal text-mindflow-heading mb-2">Something went wrong</h2>
            <p className="text-sm text-mindflow-muted mb-3">
              An unexpected error occurred. Your data is saved locally and should be safe.
            </p>
            {this.state.error && (
              <details className="mb-5 text-left">
                <summary className="text-xs text-mindflow-muted cursor-pointer hover:text-mindflow-text">
                  Error details (for debugging)
                </summary>
                <pre className="mt-2 bg-mindflow-surface-alt rounded-lg p-3 text-xs text-mindflow-text overflow-auto max-h-32">
                  {this.state.error.message || String(this.state.error)}
                </pre>
              </details>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-mindflow-accent px-6 py-2 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover shadow-sm"
              >
                Reload page
              </button>
              <button
                type="button"
                onClick={() => { clearAll(); window.location.reload(); }}
                className="rounded-full border border-mindflow-border px-6 py-2 text-sm font-medium text-mindflow-muted hover:bg-mindflow-surface-alt"
              >
                Reset all data
              </button>
            </div>
            <p className="text-xs text-mindflow-muted mt-3">
              Reloading restores this screen only if the crash comes from saved data — use
              Reset all data to wipe the local data and start fresh.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
