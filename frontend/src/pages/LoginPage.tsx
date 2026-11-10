import { type FormEvent, useState } from 'react';
import { apiRequest } from '../api';
import { ThemeToggle } from '../theme';

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      onLogin();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    }
  };

  return (
    <main className="guest-shell">
      <form className="guest-card login-card" onSubmit={login}>
        <div className="login-theme"><ThemeToggle /></div>
        <div className="seal" />
        <p className="eyebrow">Host access</p>
        <h1>Enter the ballroom</h1>
        <label htmlFor="host-pin">Host PIN</label>
        <input
          id="host-pin"
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="primary-button">Continue</button>
      </form>
    </main>
  );
}
