import type { Participant } from '@prisma/client';
import QRCode from 'qrcode';

export type ParticipantWithQr = Participant & {
  invitationUrl: string;
  qrCode: string;
};

export async function prepareParticipant(participant: Participant, baseUrl: string): Promise<ParticipantWithQr> {
  const invitationUrl = `${baseUrl}/activate/${participant.activationToken}`;
  const qrCode = await QRCode.toDataURL(invitationUrl, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: 'M',
  });

  return { ...participant, invitationUrl, qrCode };
}
