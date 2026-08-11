import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { GoogleAuthProvider } from './utils/googleAuth.jsx'

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
