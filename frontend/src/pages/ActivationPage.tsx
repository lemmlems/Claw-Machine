import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { GuestPayload } from '../types';
import { ThemeToggle } from '../theme';

export function ActivationPage({ token }: { token: string }) {
  const [state, setState] = useState<GuestPayload | null>(null);

  useEffect(() => {
    apiRequest<GuestPayload>(`/api/activate/${encodeURIComponent(token)}`)
      .then(setState)
      .catch((error: unknown) => {
        setState({
          valid: false,
          message: error instanceof Error ? error.message : 'This invitation could not be activated.',
        });
      });
  }, [token]);

  const name = state?.participant?.name ?? 'Guest';
  return (
    <div className="guest-shell">
      <div className="guest-card">
        <div className="activation-theme"><ThemeToggle /></div>
        <div className="seal" />
        <p className="eyebrow">Invitation</p>
        <h1>{state?.status === 'activated' ? 'Welcome to the ball' : 'An invitation awaits'}</h1>
        <p className="guest-message">{state?.message ?? 'Your invitation is being checked.'}</p>
        {state?.status === 'activated' && <div className="arrival-badge">{name} has arrived</div>}
        {state?.status === 'already' && <div className="arrival-badge">{name} is already here</div>}
        {state?.valid === false && <div className="arrival-badge muted">Invitation declined</div>}
      </div>
    </div>
  );
}
