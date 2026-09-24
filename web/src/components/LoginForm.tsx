import { useState, type FormEvent } from 'react';

export function LoginForm(props: {
  onSubmit: (email: string, password: string) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    props.onSubmit(email, password);
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {props.error && <p className="error">{props.error}</p>}
      <button type="submit" disabled={props.submitting}>
        {props.submitting ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}
