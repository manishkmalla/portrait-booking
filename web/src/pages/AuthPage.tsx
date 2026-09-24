import { useState } from 'react';
import { LoginForm } from '../components/LoginForm';
import { RegisterForm } from '../components/RegisterForm';
import { apiFetch } from '../lib/api';
import type { User } from '../types';

export function AuthPage(props: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(email: string, password: string) {
    setSubmitting(true);
    setError(null);
    try {
      const user = await apiFetch<User>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      props.onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(email: string, password: string) {
    setSubmitting(true);
    setError(null);
    try {
      const user = await apiFetch<User>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      props.onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
  }

  return (
    <main className="auth-page">
      <h1>Portrait Booking</h1>
      {mode === 'login' ? (
        <LoginForm onSubmit={handleLogin} submitting={submitting} error={error} />
      ) : (
        <RegisterForm onSubmit={handleRegister} submitting={submitting} error={error} />
      )}
      <button type="button" className="link-button" onClick={switchMode}>
        {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Log in'}
      </button>
    </main>
  );
}
