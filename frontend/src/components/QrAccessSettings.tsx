import { type FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../api';
import type { HostPayload } from '../types';

function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatReadableDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function QrAccessSettings({
  qrAccess,
  refreshHost,
  onError,
}: {
  qrAccess?: HostPayload['qrAccess'];
  refreshHost: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const openAt = qrAccess?.openAt ?? null;
  const closed = qrAccess?.closed ?? false;

  const [dateTimeDraft, setDateTimeDraft] = useState(() => toDateTimeLocalValue(openAt));
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setDateTimeDraft(toDateTimeLocalValue(openAt));
  }, [openAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const openAtMs = openAt ? new Date(openAt).getTime() : null;
  const isWaitingForSchedule = !closed && openAtMs !== null && !Number.isNaN(openAtMs) && nowMs < openAtMs;

  const updateQrAccess = async (body: { openAt?: string | null; closed?: boolean }, successMessage: string) => {
    setIsSaving(true);
    setNotice(null);
    onError(null);
    try {
      await apiRequest('/api/settings/qr-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await refreshHost();
      setNotice(successMessage);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to update QR access settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSchedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!dateTimeDraft) {
      await updateQrAccess({ openAt: null }, 'QR opening schedule cleared.');
      return;
    }
    const parsed = new Date(dateTimeDraft);
    if (Number.isNaN(parsed.getTime())) {
      onError('Please enter a valid opening date and time.');
      return;
    }
    await updateQrAccess(
      { openAt: parsed.toISOString() },
      `QR will open on ${formatReadableDateTime(parsed.toISOString())}.`,
    );
  };

  const handleClearSchedule = async () => {
    setDateTimeDraft('');
    await updateQrAccess({ openAt: null }, 'QR opening schedule cleared.');
  };

  const handleToggleClosed = async () => {
    await updateQrAccess(
      { closed: !closed },
      !closed ? 'QR check-in is now closed.' : 'QR check-in has been reopened.',
    );
  };

  return (
    <section className="qr-access-settings">
      <h3>QR Check-In Access</h3>

      <p
        className={`qr-status-banner ${closed ? 'closed' : isWaitingForSchedule ? 'scheduled' : 'open'}`}
        role="status"
      >
        {closed
          ? 'QR Closed: guests cannot scan invitations right now.'
          : isWaitingForSchedule && openAt
            ? `Scheduled: QR opens ${formatReadableDateTime(openAt)}`
            : 'QR Open: guests can scan their invitations now.'}
      </p>

      <form onSubmit={handleSaveSchedule} className="qr-schedule-form">
        <label htmlFor="qr-open-at">QR Opening Date &amp; Time</label>
        <input
          id="qr-open-at"
          type="datetime-local"
          value={dateTimeDraft}
          onChange={(event) => setDateTimeDraft(event.target.value)}
          disabled={isSaving}
        />
        <div className="qr-schedule-actions">
          <button type="submit" className="primary-button" disabled={isSaving}>
            Save Date &amp; Time
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleClearSchedule()}
            disabled={isSaving || (!openAt && !dateTimeDraft)}
          >
            Clear
          </button>
        </div>
      </form>

      <button
        type="button"
        className={closed ? 'primary-button qr-toggle-button' : 'secondary-button delete-guests-button qr-toggle-button'}
        onClick={() => void handleToggleClosed()}
        disabled={isSaving}
      >
        {closed ? 'Open QR' : 'Close QR'}
      </button>

      {notice && <p className="qr-access-notice" role="status">{notice}</p>}
    </section>
  );
}
