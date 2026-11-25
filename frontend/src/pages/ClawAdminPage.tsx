import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { PageHeader } from '../components/PageHeader';
import type { HostPayload } from '../types';

export function ClawAdminPage({ onLogout }: { onLogout: () => void }) {
  const [hostState, setHostState] = useState<HostPayload | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestRole, setGuestRole] = useState<'EMPLOYEE' | 'INTERN'>('EMPLOYEE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const refreshHost = useCallback(async () => {
    const payload = await apiRequest<HostPayload>('/api/event');
    setHostState(payload);
  }, []);

  useEffect(() => {
    void refreshHost().catch((error: unknown) => {
      setFormError(error instanceof Error ? error.message : 'Unable to load the Promenade Claw admin controls.');
    });

    const stream = new EventSource('/api/events/stream');
    stream.addEventListener('state', (event) => {
      try {
        const nextPayload = JSON.parse((event as MessageEvent).data) as HostPayload;
        setHostState(nextPayload);
      } catch {
        void refreshHost().catch((error: unknown) => {
          setFormError(error instanceof Error ? error.message : 'Unable to refresh the Promenade Claw state.');
        });
      }
    });
    return () => stream.close();
  }, [refreshHost]);

  const prizeCategory = hostState?.clawSettings?.prizeCategory ?? 'MINOR';
  const minorInternsOnly = prizeCategory === 'MINOR' && Boolean(hostState?.clawSettings?.minorInternsOnly);

  const updateClawSettings = async (next: {
    prizeCategory: 'MINOR' | 'MAJOR';
    minorInternsOnly: boolean;
    resetPool: boolean;
  }) => {
    setIsUpdatingMode(true);
    setFormError(null);
    try {
      const response = await apiRequest<{ ok: boolean; payload?: HostPayload }>('/api/events/claw-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (response.payload) {
        setHostState(response.payload);
      } else {
        await refreshHost();
      }
      if (next.prizeCategory === 'MAJOR') {
        setStatusNotice('Major Prizes active — only Employees are shown on the Promenade Claw.');
      } else if (next.minorInternsOnly) {
        setStatusNotice('Minor Prizes active — only Interns and Guests are shown on the Promenade Claw.');
      } else {
        setStatusNotice('Minor Prizes active — all arrived guests are shown on the Promenade Claw.');
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to update prize mode.');
    } finally {
      setIsUpdatingMode(false);
    }
  };

  const addGuestManually = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = guestName.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiRequest('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, role: guestRole, arrived: true }),
      });
      setGuestName('');
      if (prizeCategory === 'MAJOR' && guestRole === 'INTERN') {
        setStatusNotice(`${trimmed} added as Intern / Guest (will appear in Minor Prizes mode).`);
      } else if (prizeCategory === 'MINOR' && minorInternsOnly && guestRole === 'EMPLOYEE') {
        setStatusNotice(`${trimmed} added as Employee (will appear when "Only for intern and guests" is unchecked).`);
      } else {
        setStatusNotice(`${trimmed} has been added to the Promenade Claw.`);
      }
      await refreshHost();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to add this guest.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hostState) {
    return (
      <main className="app-shell">
        <p className="form-error">{formError ?? 'Loading Promenade Claw Admin…'}</p>
      </main>
    );
  }

  const activeParticipants = hostState.participants.filter((p) => p.status === 'ACTIVE');
  const activeEmployees = activeParticipants.filter((p) => p.role === 'EMPLOYEE');
  const activeInterns = activeParticipants.filter((p) => p.role === 'INTERN');
  const eligibleInClaw = activeParticipants.filter((p) => {
    if (prizeCategory === 'MAJOR') return p.role === 'EMPLOYEE';
    if (minorInternsOnly) return p.role === 'INTERN';
    return true;
  });

  const activeModeSummary = prizeCategory === 'MAJOR'
    ? 'Major Prizes · Employees Only'
    : minorInternsOnly
      ? 'Minor Prizes · Only Interns & Guests'
      : 'Minor Prizes · All Arrived Guests';

  return (
    <div className="app-shell">
      <PageHeader>
        <button type="button" className="nav-button" onClick={onLogout}>Sign out</button>
      </PageHeader>

      <div className="host-layout">
        <aside className="sidebar panel">
          <div>
            <p className="eyebrow">Promenade Claw Admin</p>
            <h2>Add Guests Manually</h2>
          </div>

          <form onSubmit={addGuestManually} className="guest-form">
            <label htmlFor="manual-guest-name">Guest name</label>
            <input
              id="manual-guest-name"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Lady Henrietta Hyde"
              disabled={isSubmitting}
            />
            <div className="role-checklist" role="group" aria-label="Guest role">
              <label className={`role-check-item ${guestRole === 'EMPLOYEE' ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={guestRole === 'EMPLOYEE'}
                  onChange={() => setGuestRole('EMPLOYEE')}
                  disabled={isSubmitting}
                />
                <span>Employee</span>
              </label>
              <label className={`role-check-item ${guestRole === 'INTERN' ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={guestRole === 'INTERN'}
                  onChange={() => setGuestRole('INTERN')}
                  disabled={isSubmitting}
                />
                <span>Intern / Guest</span>
              </label>
            </div>
            <button type="submit" className="primary-button" disabled={isSubmitting || !guestName.trim()}>
              {isSubmitting ? 'Adding…' : 'Add to the Claw'}
            </button>
          </form>

          {formError && <p className="form-error" role="alert">{formError}</p>}
          {statusNotice && <p className="claw-admin-notice" role="status">{statusNotice}</p>}

          <div className="status-grid">
            <div className="stat-box"><span>In Claw</span><strong>{eligibleInClaw.length}</strong></div>
            <div className="stat-box"><span>Employees</span><strong>{activeEmployees.length}</strong></div>
            <div className="stat-box"><span>Interns / Guests</span><strong>{activeInterns.length}</strong></div>
          </div>
        </aside>

        <main className="panel main-panel">
          <div className="ticker" aria-live="polite">
            {(hostState.gossip.length > 0 ? hostState.gossip : ['The Promenade Claw is ready for your command.']).map((line, index) => (
              <span key={`${index}-${line}`}>{line}</span>
            ))}
          </div>

          <section className="list-panel claw-admin-prize-panel">
            <div className="claw-admin-prize-header">
              <div>
                <p className="eyebrow">Claw Configuration</p>
                <h2>Prize Mode Controls</h2>
              </div>
              <span className="claw-mode-pill">{activeModeSummary}</span>
            </div>

            <div className="claw-admin-mode-bar" role="group" aria-label="Prize category selection">
              <button
                type="button"
                className={`claw-prize-button ${prizeCategory === 'MINOR' ? 'active' : ''}`}
                aria-pressed={prizeCategory === 'MINOR'}
                disabled={isUpdatingMode}
                onClick={() => void updateClawSettings({
                  prizeCategory: 'MINOR',
                  minorInternsOnly,
                  resetPool: true,
                })}
              >
                Minor Prizes
              </button>
              <button
                type="button"
                className={`claw-prize-button ${prizeCategory === 'MAJOR' ? 'active' : ''}`}
                aria-pressed={prizeCategory === 'MAJOR'}
                disabled={isUpdatingMode}
                onClick={() => void updateClawSettings({
                  prizeCategory: 'MAJOR',
                  minorInternsOnly: false,
                  resetPool: true,
                })}
              >
                Major Prizes
              </button>
            </div>

            {prizeCategory === 'MINOR' && (
              <label className="claw-intern-only-checkbox">
                <input
                  type="checkbox"
                  checked={minorInternsOnly}
                  disabled={isUpdatingMode}
                  onChange={(event) => void updateClawSettings({
                    prizeCategory: 'MINOR',
                    minorInternsOnly: event.target.checked,
                    resetPool: false,
                  })}
                />
                <span>Only for intern and guests</span>
              </label>
            )}
          </section>

          <section className="list-panel">
            <div className="claw-admin-prize-header">
              <div>
                <p className="eyebrow">Live Vitrine Preview</p>
                <h2>Guests Currently on the Claw ({eligibleInClaw.length})</h2>
              </div>
              <a
                href="/claw"
                target="_blank"
                rel="noopener noreferrer"
                className="secondary-button"
                style={{ textDecoration: 'none' }}
              >
                Open User Promenade Claw ↗
              </a>
            </div>

            <div className="claw-admin-roster">
              {eligibleInClaw.length === 0 ? (
                <p className="empty-state">No eligible guests are currently in the claw vitrine.</p>
              ) : (
                eligibleInClaw.map((participant) => (
                  <div key={participant.id} className="claw-admin-roster-item">
                    <strong>{participant.name}</strong>
                    <span className="claw-role-tag">
                      {participant.role === 'EMPLOYEE' ? 'Employee' : 'Intern / Guest'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
