import type { Participant } from '../types';

export function GuestQrCard({
  participant,
}: {
  participant: Participant;
  disabled?: boolean;
}) {
  if (!participant.qrCode) return null;

  return (
    <div className="invitation-qr">
      <img src={participant.qrCode} alt={`${participant.name} invitation QR code`} />
    </div>
  );
}
