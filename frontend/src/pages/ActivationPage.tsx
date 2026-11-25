import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { GuestPayload } from '../types';
import { ThemeToggle, useTheme } from '../theme';

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

export function ActivationPage({ token }: { token: string }) {
  const [state, setState] = useState<GuestPayload | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { theme } = useTheme();

  const checkActivation = useCallback(() => {
    setIsChecking(true);
    apiRequest<GuestPayload>(`/api/activate/${encodeURIComponent(token)}`)
      .then(setState)
      .catch((error: unknown) => {
        setState({
          valid: false,
          status: 'invalid',
          message: error instanceof Error ? error.message : 'This invitation could not be activated.',
        });
      })
      .finally(() => setIsChecking(false));
  }, [token]);

  useEffect(() => {
    checkActivation();
  }, [checkActivation]);

  const qrOpenAtMs = state?.qrOpenAt ? new Date(state.qrOpenAt).getTime() : null;
  const isNotOpenYet = state?.status === 'not-open-yet';
  const isClosed = state?.status === 'closed';

  useEffect(() => {
    if (!isNotOpenYet || !qrOpenAtMs || Number.isNaN(qrOpenAtMs)) return;

    const timer = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (current >= qrOpenAtMs) {
        window.clearInterval(timer);
        checkActivation();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isNotOpenYet, qrOpenAtMs, checkActivation]);

  const name = state?.participant?.name ?? 'Guest';
  const logoSrc = theme === 'dark'
    ? '/phone_lady_whistledown_darkmode.png'
    : '/phone_lady_whistledown.png';

  const openDateObj = state?.qrOpenAt ? new Date(state.qrOpenAt) : null;
  const formattedDate = openDateObj && !Number.isNaN(openDateObj.getTime())
    ? openDateObj.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const formattedTime = openDateObj && !Number.isNaN(openDateObj.getTime())
    ? openDateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const remainingMs = qrOpenAtMs ? Math.max(0, qrOpenAtMs - nowMs) : 0;

  // Phone Page 1: Scheduled Date & Time has NOT arrived yet
  if (isNotOpenYet) {
    return (
      <div className="guest-shell">
        <div className="guest-card guest-card-scheduled">
          <div className="activation-theme"><ThemeToggle /></div>
          <img src={logoSrc} alt="Lady Whistledown crest" className="whistledown-logo" />
          <p className="eyebrow">Doors Not Yet Open</p>
          <h1>Patience, Dearest Gentle Reader</h1>
          <div className="guest-letter">
            <p>
              Your invitation is indeed in order, <strong>{name}</strong>, yet the ballroom doors have not yet opened for this evening&rsquo;s gathering.
            </p>
            <p>
              Pray return and scan your QR invitation once the appointed date and time arrives.
            </p>
          </div>

          {formattedDate && formattedTime && (
            <div className="qr-schedule-box" aria-live="polite">
              <span className="qr-schedule-kicker">Ballroom Opens</span>
              <strong className="qr-schedule-date">{formattedDate}</strong>
              <span className="qr-schedule-time">{formattedTime}</span>
              <div className="qr-countdown">
                {remainingMs > 0 ? `Opens in ${formatCountdown(remainingMs)}` : 'The appointed hour has arrived!'}
              </div>
            </div>
          )}

          <div className="qr-phone-actions">
            <button
              type="button"
              className="primary-button"
              onClick={checkActivation}
              disabled={isChecking}
            >
              {isChecking ? 'Checking…' : 'Check Again'}
            </button>
          </div>

          <div className="arrival-badge scheduled">QR Not Yet Open</div>
        </div>
      </div>
    );
  }

  // Phone Page 2: QR Closed by Admin
  if (isClosed) {
    return (
      <div className="guest-shell">
        <div className="guest-card guest-card-closed">
          <div className="activation-theme"><ThemeToggle /></div>
          <img src={logoSrc} alt="Lady Whistledown crest" className="whistledown-logo" />
          <p className="eyebrow">QR Check-In Closed</p>
          <h1>The Ballroom Doors Have Closed</h1>
          <div className="guest-letter">
            <p>
              Dearest <strong>{name}</strong>, QR check-in for this evening&rsquo;s gathering has been closed by the host.
            </p>
            <p>
              Should you still require admittance or assistance, pray speak directly with your host at the entrance.
            </p>
            <p className="guest-letter-signoff">
              Yours truly,<br />
              <strong>Lady Whistledown</strong>
            </p>
          </div>
          <div className="arrival-badge closed">QR Check-In Closed</div>
        </div>
      </div>
    );
  }

  // Phone Page 3: QR Open (Date & Time is up) — Welcome & Activated
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
              Delightful news has reached my desk, and it is a pleasure to welcome {name} to our gathering. Your presence brings wonderful warmth to the evening, and the event is already abuzz to see which diamonds shine the brightest.
            </p>
            <p>
              Relax, mingle, and enjoy what promises to be an unforgettable night.
            </p>
            <p className="guest-letter-signoff">
              Yours truly,<br />
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
