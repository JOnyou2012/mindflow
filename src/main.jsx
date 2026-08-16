import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { GoogleAuthProvider } from './utils/googleAuth.jsx'
import { stampSchemaVersion } from './utils/storage.js'

// Record the persisted-data schema version so future migrations can detect
// what a returning user's localStorage was written by.
stampSchemaVersion();

// Catch unhandled promise rejections (async errors outside React render).
// These are not caught by ErrorBoundary — log them for production debugging.
window.addEventListener('unhandledrejection', (event) => {
  console.error('MindFlow unhandled promise rejection:', event.reason);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <App />
      </GoogleAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
