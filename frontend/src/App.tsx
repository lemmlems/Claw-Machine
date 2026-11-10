import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';
import { ThemeProvider } from './theme';
import { ActivationPage } from './pages/ActivationPage';
import { ClawPage } from './pages/ClawPage';
import { GuestLedger } from './pages/GuestLedger';
import { LoginPage } from './pages/LoginPage';

type SessionPayload = { authenticated: boolean };

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const activationToken = useMemo(() => {
    const match = window.location.pathname.match(/^\/activate\/([^/]+)\/?$/);
    return match
      ? decodeURIComponent(match[1])
      : new URLSearchParams(window.location.search).get('activation');
  }, []);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(!activationToken);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (activationToken) return;
    apiRequest<SessionPayload>('/api/auth/session')
      .then((session) => setAuthenticated(session.authenticated))
      .catch((error: unknown) => {
        setSessionError(error instanceof Error ? error.message : 'Unable to check the host session.');
      })
      .finally(() => setCheckingSession(false));
  }, [activationToken]);

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      setAuthenticated(false);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  if (activationToken) return <ActivationPage token={activationToken} />;
  if (checkingSession) return <main className="app-shell"><p>Checking host session…</p></main>;
  if (!authenticated) {
    return (
      <>
        {sessionError && <p className="form-error session-error" role="alert">{sessionError}</p>}
        <LoginPage onLogin={() => {
          setSessionError(null);
          setAuthenticated(true);
        }} />
      </>
    );
  }

  if (window.location.pathname === '/claw') return <ClawPage />;
  return <GuestLedger onLogout={() => void logout()} />;
}

export default App;
