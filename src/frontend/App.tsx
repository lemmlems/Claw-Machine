import { type FormEvent, useEffect, useMemo, useState } from 'react';

type ParticipantStatus = 'INACTIVE' | 'ACTIVE' | 'WON';

type Participant = {
  id: string;
  name: string;
  status: ParticipantStatus;
  createdAt: string;
  activatedAt?: string | null;
  invitationUrl?: string;
  qrCode?: string;
};

type EventData = {
  id: string;
  name: string;
  status: string;
  currentRound: number;
};

type HostPayload = {
  event: EventData;
  participants: Participant[];
  winner?: {
    participantName: string;
    message: string;
  } | null;
  gossip: string[];
};

type GuestPayload = {
  valid: boolean;
  status?: 'activated' | 'already' | 'invalid' | 'already-won';
  message: string;
  participant?: {
    name: string;
  };
};

function App() {
  const guestToken = useMemo(() => {
    if (!window.location.pathname.startsWith('/activate/')) return null;
    return window.location.pathname.split('/').filter(Boolean).at(-1) ?? null;
  }, []);

  const [hostState, setHostState] = useState<HostPayload | null>(null);
  const [guestState, setGuestState] = useState<GuestPayload | null>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const refreshHost = async () => {
    const response = await fetch('/api/event');
    const payload = await response.json();
    setHostState(payload);
  };

  useEffect(() => {
    const isGuestPage = Boolean(guestToken);

    if (isGuestPage) {
      fetch(`/api/activate/${guestToken}`)
        .then((response) => response.json())
        .then((payload) => setGuestState(payload))
        .catch(() => {
          setGuestState({
            valid: false,
            message: 'This invitation is not valid, or the ball has closed. Pray, ask your host.',
          });
        });
      return;
    }

    void refreshHost();
    const stream = new EventSource('/api/events/stream');
    stream.addEventListener('state', () => {
      void refreshHost();
    });

    return () => stream.close();
  }, [guestToken]);

  if (guestToken) {
    return <GuestScreen state={guestState} token={guestToken} />;
  }

  return (
    <HostScreen
      hostState={hostState}
      name={name}
      setName={setName}
      formError={formError}
      setFormError={setFormError}
      refreshHost={refreshHost}
    />
  );
}

function GuestScreen({ state, token }: { state: GuestPayload | null; token: string }) {
  const message = state?.message ?? 'This invitation is not valid, or the ball has closed. Pray, ask your host.';
  const name = state?.participant?.name ?? 'Guest';

  return (
    <div className="guest-shell">
      <div className="guest-card">
        <div className="seal" />
        <p className="eyebrow">Invitation</p>
        <h1>{state?.status === 'activated' ? 'Welcome to the ball' : 'An invitation awaits'}</h1>
        <p className="guest-message">{message}</p>
        {state?.status === 'activated' && <div className="arrival-badge">{name} has arrived</div>}
        {state?.status === 'already' && <div className="arrival-badge">{name} is already here</div>}
        {state?.valid === false && <div className="arrival-badge muted">Invitation declined</div>}
        <div className="guest-footer">
          <span>Token</span>
          <code>{token}</code>
        </div>
      </div>
    </div>
  );
}

function HostScreen({
  hostState,
  name,
  setName,
  formError,
  setFormError,
  refreshHost,
}: {
  hostState: HostPayload | null;
  name: string;
  setName: (value: string) => void;
  formError: string | null;
  setFormError: (value: string | null) => void;
  refreshHost: () => Promise<void>;
}) {
  const activeNames = hostState?.participants.filter((participant) => participant.status === 'ACTIVE') ?? [];
  const inactiveNames = hostState?.participants.filter((participant) => participant.status === 'INACTIVE') ?? [];
  const wonNames = hostState?.participants.filter((participant) => participant.status === 'WON') ?? [];

  const addGuest = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setFormError('Please enter a guest name.');
      return;
    }

    setFormError(null);

    const response = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setFormError(payload.message ?? 'Unable to add this guest to the list.');
      return;
    }

    setName('');
    await refreshHost();
  };

  const pickWinner = async () => {
    const response = await fetch('/api/events/select-winner', { method: 'POST' });
    const payload = await response.json();
    if (!response.ok) {
      setFormError(payload.message ?? 'No guest is ready for selection.');
      return;
    }

    setFormError(null);
    await refreshHost();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Regency Drawing Room</p>
          <h1>The Ton's Claw</h1>
        </div>
        <div className="title-tag">A Most Diverting Selection</div>
      </header>

      <div className="host-layout">
        <aside className="sidebar panel">
          <h2>Guest Ledger</h2>
          <form onSubmit={addGuest} className="guest-form">
            <label htmlFor="name">New guest</label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Lady Henrietta Hyde"
              maxLength={25}
            />
            <button type="submit" className="primary-button">
              Add to the Ball
            </button>
          </form>

          {formError && <p className="form-error">{formError}</p>}

          <div className="status-grid">
            <div className="stat-box">
              <span>Awaiting Invitation</span>
              <strong>{inactiveNames.length}</strong>
            </div>
            <div className="stat-box">
              <span>Arrived</span>
              <strong>{activeNames.length}</strong>
            </div>
            <div className="stat-box">
              <span>Chosen</span>
              <strong>{wonNames.length}</strong>
            </div>
          </div>

          <button type="button" className="select-button" onClick={pickWinner}>
            Select the Diamond
          </button>

        </aside>

        <main className="panel main-panel">
          <div className="ticker" aria-live="polite">
            {(hostState?.gossip && hostState.gossip.length > 0 ? hostState.gossip : ['The ballroom is ready for a new season.']).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="print-actions">
            <button type="button" className="secondary-button" onClick={() => window.print()}>
              Print invitations
            </button>
          </div>

          {hostState?.winner && (
            <div className="winner-reveal" aria-live="polite">
              <p className="eyebrow">The Diamond of the Season</p>
              <h2>{hostState.winner.participantName}</h2>
              <p>{hostState.winner.message}</p>
            </div>
          )}

          <div className="columns">
            <section className="list-panel">
              <h3>Awaiting Invitation</h3>
              <div className="guest-list">
                {inactiveNames.length === 0 ? (
                  <p className="empty-state">No guests have arrived yet. The ballroom awaits.</p>
                ) : (
                  inactiveNames.map((participant) => (
                    <article key={participant.id} className="guest-card-item inactive">
                      <div className="mini-seal" />
                      <div>
                        <h4>{participant.name}</h4>
                        <small>Awaiting Invitation</small>
                      </div>
                      {participant.qrCode && (
                        <div className="invitation-qr">
                          <img src={participant.qrCode} alt={`${participant.name} invitation QR code`} />
                          <span className="invitation-url">{participant.invitationUrl}</span>
                          <a
                            href={participant.qrCode}
                            download={`${participant.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-invitation.png`}
                          >
                            Download QR
                          </a>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="list-panel">
              <h3>Arrived</h3>
              <div className="guest-list">
                {activeNames.length === 0 ? (
                  <p className="empty-state">No guests have arrived yet. The ballroom awaits.</p>
                ) : (
                  activeNames.map((participant) => (
                    <article key={participant.id} className="guest-card-item active">
                      <div className="mini-seal" />
                      <div>
                        <h4>{participant.name}</h4>
                        <small>Arrived</small>
                      </div>
                      <span className="chip">Ready</span>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
