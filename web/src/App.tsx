import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Nav } from './components/Nav';
import { apiFetch } from './lib/api';
import { AuthPage } from './pages/AuthPage';
import { CreateSlotPage } from './pages/CreateSlotPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { SlotsPage } from './pages/SlotsPage';
import type { User } from './types';

export type View = 'slots' | 'my-bookings' | 'create-slot';

type AuthStatus = 'checking' | 'anonymous' | 'authenticated';

export function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [view, setView] = useState<View>('slots');

  useEffect(() => {
    apiFetch<User>('/api/auth/me')
      .then((restoredUser) => {
        setUser(restoredUser);
        setAuthStatus('authenticated');
      })
      .catch(() => {
        setAuthStatus('anonymous');
      });
  }, []);

  function handleAuthenticated(authenticatedUser: User) {
    setUser(authenticatedUser);
    setAuthStatus('authenticated');
    setView('slots');
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setAuthStatus('anonymous');
    } catch {
      // Logout failing (e.g. offline) leaves the session as-is; the user
      // can retry rather than being silently dropped into a broken state.
    } finally {
      setLoggingOut(false);
    }
  }

  if (authStatus === 'checking') {
    return <p className="loading">Loading…</p>;
  }

  if (authStatus === 'anonymous' || !user) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <>
      <Header user={user} onLogout={handleLogout} loggingOut={loggingOut} />
      <Nav view={view} role={user.role} onChange={setView} />
      <main>
        {view === 'slots' && <SlotsPage role={user.role} />}
        {view === 'my-bookings' && user.role === 'client' && <MyBookingsPage />}
        {view === 'create-slot' && user.role === 'photographer' && <CreateSlotPage />}
      </main>
    </>
  );
}
