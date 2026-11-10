import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { GuestPayload } from '../types';
import { ThemeToggle, useTheme } from '../theme';

export function ActivationPage({ token }: { token: string }) {
  const [state, setState] = useState<GuestPayload | null>(null);
  const { theme } = useTheme();

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
  const logoSrc = theme === 'dark'
    ? '/phone_lady_whistledown_darkmode.png'
    : '/phone_lady_whistledown.png';

  return (
    <div className="guest-shell">
      <div className="guest-card">
        <div className="activation-theme"><ThemeToggle /></div>
        <img src={logoSrc} alt="Lady Whistledown crest" className="whistledown-logo" />
        <p className="eyebrow">Invitation</p>
        <h1>Dearest Gentle Reader</h1>
        {state?.valid ? (
          <div className="guest-letter">
            <p>
              Delightful news has reached my desk, and it is a pleasure to welcome {name} to our gathering. Your presence brings wonderful warmth to the evening, and the ton is already abuzz to see which diamonds shine the brightest.
            </p>
            <p>
              Relax, mingle, and enjoy what promises to be an unforgettable night.
            </p>
            <p className="guest-letter-signoff">
              Yours warmly,<br />
              <strong>Lady Whistledown</strong>
            </p>
          </div>
        ) : (
          <p className="guest-message">{state?.message ?? 'Your invitation is being checked.'}</p>
        )}
        {state?.status === 'activated' && <div className="arrival-badge">{name} has arrived</div>}
        {state?.status === 'already' && <div className="arrival-badge">{name} is already here</div>}
        {state?.status === 'already-won' && <div className="arrival-badge">{name} has been chosen</div>}
        {state?.valid === false && <div className="arrival-badge muted">Invitation declined</div>}
      </div>
    </div>
  );
}
