import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { GuestQrCard } from '../components/GuestQrCard';
import { PageHeader } from '../components/PageHeader';
import { PublicAddressSettings } from '../components/PublicAddressSettings';
import type { HostPayload } from '../types';

export function GuestLedger({ onLogout }: { onLogout: () => void }) {
  const [hostState, setHostState] = useState<HostPayload | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'EMPLOYEE' | 'INTERN'>('EMPLOYEE');
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [isDeletingGuests, setIsDeletingGuests] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refreshHost = useCallback(async () => {
    const payload = await apiRequest<HostPayload>('/api/event');
    setHostState(payload);
    setSelectedGuestIds((current) => current.filter(
      (id) => payload.participants.some((participant) => participant.id === id),
    ));
  }, []);

  useEffect(() => {
    void refreshHost().catch((error: unknown) => {
      setFormError(error instanceof Error ? error.message : 'Unable to load the guest ledger.');
    });

    const stream = new EventSource('/api/events/stream');
    stream.addEventListener('state', () => {
      void refreshHost().catch((error: unknown) => {
        setFormError(error instanceof Error ? error.message : 'Unable to refresh the guest ledger.');
      });
    });
    return () => stream.close();
  }, [refreshHost]);

  const addGuest = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role }),
      });
      setName('');
      setFormError(null);
      await refreshHost();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to add this guest.');
    }
  };

  const markGuestArrived = async (participantId: string) => {
    try {
      await apiRequest(`/api/participants/${encodeURIComponent(participantId)}/arrive`, {
        method: 'POST',
      });
      setFormError(null);
      await refreshHost();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to mark guest as arrived.');
    }
  };

  const toggleGuestSelection = (participantId: string) => {
    setSelectedGuestIds((current) => current.includes(participantId)
      ? current.filter((id) => id !== participantId)
      : [...current, participantId]);
  };

  const deleteSelectedGuests = async () => {
    setIsDeletingGuests(true);
    try {
      await apiRequest('/api/participants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedGuestIds }),
      });
      setSelectedGuestIds([]);
      setFormError(null);
      await refreshHost();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to delete the selected guests.');
    } finally {
      setIsDeletingGuests(false);
    }
  };

  if (!hostState) {
    return <main className="app-shell"><p className="form-error">{formError ?? 'Loading the guest ledger…'}</p></main>;
  }

  const arrivedNames = hostState.participants.filter(
    (participant) => participant.status === 'ACTIVE' || participant.status === 'WON',
  );
  const inactiveNames = hostState.participants.filter((participant) => participant.status === 'INACTIVE');
  const wonNames = hostState.participants.filter(
    (participant) => participant.status === 'WON' || participant.hasWon,
  );
  const isLocalAddress = hostState.publicAddress.isLocal;

  return (
    <div className="app-shell">
      <PageHeader>
        <button type="button" className="nav-button" onClick={onLogout}>Sign out</button>
      </PageHeader>
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
            />
            <div className="role-checklist" role="group" aria-label="Guest role">
              <label className={`role-check-item ${role === 'EMPLOYEE' ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={role === 'EMPLOYEE'}
                  onChange={() => setRole('EMPLOYEE')}
                />
                <span>Employee</span>
              </label>
              <label className={`role-check-item ${role === 'INTERN' ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={role === 'INTERN'}
                  onChange={() => setRole('INTERN')}
                />
                <span>Intern / Guest</span>
              </label>
            </div>
            <button
              type="button"
              className="secondary-button delete-guests-button"
              onClick={() => void deleteSelectedGuests()}
              disabled={selectedGuestIds.length === 0 || isDeletingGuests}
            >
              Delete Guests
            </button>
            <button type="submit" className="primary-button">Add to the Ball</button>
          </form>

          {formError && <p className="form-error" role="alert">{formError}</p>}

          <div className="status-grid">
            <div className="stat-box"><span>Awaiting Invitation</span><strong>{inactiveNames.length}</strong></div>
            <div className="stat-box"><span>Arrived</span><strong>{arrivedNames.length}</strong></div>
            <div className="stat-box"><span>Chosen</span><strong>{wonNames.length}</strong></div>
          </div>

          <PublicAddressSettings
            publicAddress={hostState.publicAddress}
            refreshHost={refreshHost}
            onError={setFormError}
          />
        </aside>

        <main className="panel main-panel">
          <div className="ticker" aria-live="polite">
            {(hostState.gossip.length > 0 ? hostState.gossip : ['The ballroom is ready for a new season.']).map((line, index) => (
              <span key={`${index}-${line}`}>{line}</span>
            ))}
          </div>
          <div className="print-actions">
            <button type="button" className="secondary-button" onClick={() => window.print()} disabled={isLocalAddress}>
              Print invitations
            </button>
          </div>
          {hostState.winner && (
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
                ) : inactiveNames.map((participant) => (
                  <article
                    key={participant.id}
                    className={`guest-card-item inactive ${selectedGuestIds.includes(participant.id) ? 'selected' : ''}`}
                    role="checkbox"
                    aria-label={`Select ${participant.name}`}
                    aria-checked={selectedGuestIds.includes(participant.id)}
                    aria-disabled={isDeletingGuests}
                    tabIndex={0}
                    onClick={() => {
                      if (!isDeletingGuests) toggleGuestSelection(participant.id);
                    }}
                    onKeyDown={(event) => {
                      if (
                        !isDeletingGuests &&
                        event.target === event.currentTarget &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        toggleGuestSelection(participant.id);
                      }
                    }}
                  >
                    <div className="mini-seal" />
                    <div className="guest-card-details">
                      <h4>{participant.name}</h4>
                      <small>Awaiting Invitation · {participant.role === 'EMPLOYEE' ? 'Employee' : 'Intern / Guest'}</small>
                      <div className="guest-card-actions">
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void markGuestArrived(participant.id);
                          }}
                        >
                          Mark arrived
                        </button>
                      </div>
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <GuestQrCard participant={participant} disabled={isLocalAddress} />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="list-panel">
              <h3>Arrived</h3>
              <div className="guest-list">
                {arrivedNames.length === 0 ? (
                  <p className="empty-state">No guests have arrived yet. The ballroom awaits.</p>
                ) : arrivedNames.map((participant) => {
                  const isChosen = participant.status === 'WON' || participant.hasWon;
                  const roleLabel = participant.role === 'EMPLOYEE' ? 'Employee' : 'Intern / Guest';
                  const activatedAt = participant.activatedAt ? new Date(participant.activatedAt) : null;
                  return (
                    <article
                      key={participant.id}
                      className={`guest-card-item active ${selectedGuestIds.includes(participant.id) ? 'selected' : ''}`}
                      role="checkbox"
                      aria-label={`Select ${participant.name}`}
                      aria-checked={selectedGuestIds.includes(participant.id)}
                      aria-disabled={isDeletingGuests}
                      tabIndex={0}
                      onClick={() => {
                        if (!isDeletingGuests) toggleGuestSelection(participant.id);
                      }}
                      onKeyDown={(event) => {
                        if (
                          !isDeletingGuests &&
                          event.target === event.currentTarget &&
                          (event.key === 'Enter' || event.key === ' ')
                        ) {
                          event.preventDefault();
                          toggleGuestSelection(participant.id);
                        }
                      }}
                    >
                      <div className="mini-seal" />
                      <div className="guest-card-details">
                        <h4>{participant.name}</h4>
                        <small>{isChosen ? `Arrived · ${roleLabel} · Chosen` : `Arrived · ${roleLabel}`}</small>
                        {activatedAt && !Number.isNaN(activatedAt.getTime()) && (
                          <small className="guest-arrival-time">
                            Arrived at{' '}
                            <time dateTime={activatedAt.toISOString()}>
                              {activatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                            </time>
                          </small>
                        )}
                      </div>
                      <span className="chip">{isChosen ? 'Chosen' : 'Ready'}</span>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
