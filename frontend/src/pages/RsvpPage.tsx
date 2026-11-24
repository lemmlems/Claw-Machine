import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api';
import { PageHeader } from '../components/PageHeader';
import type { HostPayload, Participant } from '../types';

export function RsvpPage({ onLogout }: { onLogout: () => void }) {
  const [hostState, setHostState] = useState<HostPayload | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'WON'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'EMPLOYEE' | 'INTERN'>('ALL');

  // Quick RSVP form state
  const [selectedGuestToArrive, setSelectedGuestToArrive] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickRole, setQuickRole] = useState<'EMPLOYEE' | 'INTERN'>('EMPLOYEE');
  const [quickArrived, setQuickArrived] = useState(true);

  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshHost = useCallback(async () => {
    const payload = await apiRequest<HostPayload>('/api/event');
    setHostState(payload);
  }, []);

  useEffect(() => {
    void refreshHost().catch((error: unknown) => {
      setFormError(error instanceof Error ? error.message : 'Unable to load RSVP data.');
    });

    const stream = new EventSource('/api/events/stream');
    stream.addEventListener('state', () => {
      void refreshHost().catch((error: unknown) => {
        setFormError(error instanceof Error ? error.message : 'Unable to refresh RSVP data.');
      });
    });
    return () => stream.close();
  }, [refreshHost]);

  // Clear notice after 4 seconds
  useEffect(() => {
    if (!successNotice) return;
    const timer = setTimeout(() => setSuccessNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [successNotice]);

  const markGuestArrived = async (participantId: string, participantName?: string) => {
    try {
      await apiRequest(`/api/participants/${encodeURIComponent(participantId)}/arrive`, {
        method: 'POST',
      });
      setFormError(null);
      setSuccessNotice(`Dearest gentle reader, ${participantName ?? 'Guest'} is now marked as attending the ball.`);
      await refreshHost();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to mark guest as attending.');
    }
  };

  const handleQuickArriveSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedGuestToArrive) return;
    const guest = hostState?.participants.find((p) => p.id === selectedGuestToArrive);
    await markGuestArrived(selectedGuestToArrive, guest?.name);
    setSelectedGuestToArrive('');
  };

  const handleAddGuestRsvp = async (event: FormEvent) => {
    event.preventDefault();
    if (!quickName.trim()) return;
    try {
      await apiRequest('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickName.trim(),
          role: quickRole,
          arrived: quickArrived,
        }),
      });
      setSuccessNotice(`Dearest guests, ${quickName.trim()} has been added to the RSVP register.`);
      setQuickName('');
      setFormError(null);
      await refreshHost();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to register this guest.');
    }
  };

  const copyInvitationLink = async (participant: Participant) => {
    if (!participant.invitationUrl) return;
    try {
      await navigator.clipboard.writeText(participant.invitationUrl);
      setCopiedId(participant.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback
      setCopiedId(null);
    }
  };

  const participants = hostState?.participants ?? [];
  const awaitingGuests = useMemo(
    () => participants.filter((p) => p.status === 'INACTIVE'),
    [participants],
  );
  const attendingGuests = useMemo(
    () => participants.filter((p) => p.status === 'ACTIVE' || p.status === 'WON'),
    [participants],
  );
  const wonGuests = useMemo(
    () => participants.filter((p) => p.status === 'WON' || p.hasWon),
    [participants],
  );

  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && p.status !== 'ACTIVE' && p.status !== 'WON') return false;
      if (statusFilter === 'INACTIVE' && p.status !== 'INACTIVE') return false;
      if (statusFilter === 'WON' && p.status !== 'WON' && !p.hasWon) return false;

      // Role filter
      if (roleFilter !== 'ALL' && p.role !== roleFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return p.name.toLowerCase().includes(query);
      }

      return true;
    });
  }, [participants, statusFilter, roleFilter, searchQuery]);

  const totalCount = participants.length;
  const attendanceRate = totalCount > 0 ? Math.round((attendingGuests.length / totalCount) * 100) : 0;

  if (!hostState) {
    return (
      <main className="app-shell">
        <p className="form-error">{formError ?? 'Loading the RSVP Register…'}</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <PageHeader>
        <button type="button" className="nav-button" onClick={onLogout}>Sign out</button>
      </PageHeader>

      <div className="host-layout">
        <aside className="sidebar panel">
          <h2>RSVP Desk</h2>

          {/* Quick Confirmation of Awaiting Guest */}
          <section className="rsvp-side-section">
            <h3 className="rsvp-side-title">Confirm Attendance</h3>
            <p className="rsvp-side-caption">
              Select an invited guest to formally record their arrival at the ballroom.
            </p>
            <form onSubmit={handleQuickArriveSubmit} className="rsvp-quick-form">
              <label htmlFor="awaiting-guest-select">Awaiting Guests</label>
              <select
                id="awaiting-guest-select"
                value={selectedGuestToArrive}
                onChange={(e) => setSelectedGuestToArrive(e.target.value)}
                disabled={awaitingGuests.length === 0}
                className="rsvp-select"
              >
                <option value="">
                  {awaitingGuests.length === 0 ? 'No guests awaiting response' : '— Choose an invited guest —'}
                </option>
                {awaitingGuests.map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.name} ({guest.role === 'EMPLOYEE' ? 'Employee' : 'Intern/Guest'})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="primary-button rsvp-action-btn"
                disabled={!selectedGuestToArrive}
              >
                Confirm Attendance
              </button>
            </form>
          </section>

          {/* Quick Add Guest Form */}
          <section className="rsvp-side-section">
            <h3 className="rsvp-side-title">New RSVP Entry</h3>
            <form onSubmit={handleAddGuestRsvp} className="guest-form">
              <label htmlFor="quick-name">Guest Name</label>
              <input
                id="quick-name"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="Lord Anthony Bridgerton"
              />

              <div className="role-checklist" role="group" aria-label="Guest role">
                <label className={`role-check-item ${quickRole === 'EMPLOYEE' ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={quickRole === 'EMPLOYEE'}
                    onChange={() => setQuickRole('EMPLOYEE')}
                  />
                  <span>Employee</span>
                </label>
                <label className={`role-check-item ${quickRole === 'INTERN' ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={quickRole === 'INTERN'}
                    onChange={() => setQuickRole('INTERN')}
                  />
                  <span>Intern / Guest</span>
                </label>
              </div>

              <label className="rsvp-checkbox-label">
                <input
                  type="checkbox"
                  checked={quickArrived}
                  onChange={(e) => setQuickArrived(e.target.checked)}
                />
                <span>Attending Immediately (Arrived)</span>
              </label>

              <button type="submit" className="secondary-button" style={{ marginTop: '6px' }}>
                Save RSVP
              </button>
            </form>
          </section>

          {formError && <p className="form-error" role="alert">{formError}</p>}
          {successNotice && <p className="rsvp-success-banner" role="status">{successNotice}</p>}

          {/* Statistics Grid */}
          <div className="status-grid rsvp-status-grid">
            <div className="stat-box">
              <span>Invited</span>
              <strong>{totalCount}</strong>
            </div>
            <div className="stat-box">
              <span>Attending</span>
              <strong>{attendingGuests.length}</strong>
            </div>
            <div className="stat-box">
              <span>Awaiting</span>
              <strong>{awaitingGuests.length}</strong>
            </div>
            <div className="stat-box rsvp-rate-box">
              <span>Response Rate</span>
              <strong>{attendanceRate}%</strong>
            </div>
          </div>
        </aside>

        <main className="panel main-panel">
          {/* Ticker */}
          <div className="ticker" aria-live="polite">
            {(hostState.gossip.length > 0 ? hostState.gossip : ['The ballroom is ready for a new season.']).map((line, index) => (
              <span key={`${index}-${line}`}>{line}</span>
            ))}
          </div>

          {/* Page Banner */}
          <div className="rsvp-header-banner">
            <div>
              <p className="eyebrow">Attendance Ledger</p>
              <h2 className="rsvp-heading">The Society RSVP Register</h2>
              <p className="rsvp-description">
                Dearest Gentle Reader, observe the distinguished members of society who have responded to this season’s summons.
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="rsvp-filter-toolbar">
            <div className="rsvp-search-box">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guests by name…"
                className="rsvp-search-input"
                aria-label="Search guests by name"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="rsvp-clear-search"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="rsvp-filter-pills" role="group" aria-label="Filter by RSVP status">
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
              >
                All Society ({totalCount})
              </button>
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ACTIVE')}
              >
                Attending ({attendingGuests.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
                onClick={() => setStatusFilter('INACTIVE')}
              >
                Awaiting ({awaitingGuests.length})
              </button>
              {wonGuests.length > 0 && (
                <button
                  type="button"
                  className={`filter-pill ${statusFilter === 'WON' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('WON')}
                >
                  Chosen ({wonGuests.length})
                </button>
              )}
            </div>

            <div className="rsvp-role-pills" role="group" aria-label="Filter by role">
              <button
                type="button"
                className={`filter-pill role-pill ${roleFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setRoleFilter('ALL')}
              >
                All Roles
              </button>
              <button
                type="button"
                className={`filter-pill role-pill ${roleFilter === 'EMPLOYEE' ? 'active' : ''}`}
                onClick={() => setRoleFilter('EMPLOYEE')}
              >
                Employees
              </button>
              <button
                type="button"
                className={`filter-pill role-pill ${roleFilter === 'INTERN' ? 'active' : ''}`}
                onClick={() => setRoleFilter('INTERN')}
              >
                Interns / Guests
              </button>
            </div>
          </div>

          {/* Guests List */}
          <div className="rsvp-roster-container">
            {filteredParticipants.length === 0 ? (
              <div className="empty-state rsvp-empty-state">
                <p>No guests match your current filter.</p>
                {searchQuery && (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ marginTop: '8px' }}
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('ALL');
                      setRoleFilter('ALL');
                    }}
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="rsvp-grid">
                {filteredParticipants.map((guest) => {
                  const isAttending = guest.status === 'ACTIVE' || guest.status === 'WON';
                  const isWon = guest.status === 'WON' || guest.hasWon;

                  return (
                    <article key={guest.id} className={`rsvp-card ${isAttending ? 'attending' : 'awaiting'}`}>
                      <div className="rsvp-card-header">
                        <div className="rsvp-guest-info">
                          <h4 className="rsvp-guest-name">{guest.name}</h4>
                          <div className="rsvp-badge-group">
                            <span className={`role-badge ${guest.role === 'EMPLOYEE' ? 'employee' : 'intern'}`}>
                              {guest.role === 'EMPLOYEE' ? 'Employee' : 'Intern / Guest'}
                            </span>
                            {isWon ? (
                              <span className="rsvp-status-badge won">💎 Chosen</span>
                            ) : isAttending ? (
                              <span className="rsvp-status-badge attending">✓ Attending</span>
                            ) : (
                              <span className="rsvp-status-badge awaiting">⏳ Awaiting Response</span>
                            )}
                          </div>
                        </div>

                        {guest.activatedAt && (
                          <span className="rsvp-timestamp">
                            Arrived {new Date(guest.activatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="rsvp-card-footer">
                        {!isAttending && (
                          <button
                            type="button"
                            className="primary-button rsvp-arrive-btn"
                            onClick={() => void markGuestArrived(guest.id, guest.name)}
                          >
                            Mark Attending
                          </button>
                        )}

                        <div className="rsvp-link-actions">
                          {guest.invitationUrl && (
                            <>
                              <button
                                type="button"
                                className="secondary-button rsvp-mini-btn"
                                onClick={() => void copyInvitationLink(guest)}
                                title="Copy guest invitation link"
                              >
                                {copiedId === guest.id ? '✓ Copied' : 'Copy Link'}
                              </button>
                              <a
                                href={guest.invitationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-button rsvp-mini-btn"
                                title="Open guest invitation in a new window"
                              >
                                View Ticket
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
