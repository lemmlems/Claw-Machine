import { createHash } from 'node:crypto';
import type { Event, Participant } from '@prisma/client';
import { config } from './config.js';
import { prisma } from './db.js';
import { getAddressState } from './address.js';
import { prepareParticipant } from './qr.js';
import { getGossip, getLatestWinner } from './state.js';

export async function ensureEvent(): Promise<Event> {
  let event = await prisma.event.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!event) {
    event = await prisma.event.create({
      data: {
        name: "The Ton's Claw",
        status: 'OPEN',
        hostTokenHash: createHash('sha256').update(`host:${Date.now()}`).digest('hex'),
        hostPinHash: createHash('sha256').update(config.hostPin).digest('hex'),
        removeWinnerAfterPick: true,
        currentRound: 1,
      },
    });
  }

  return event;
}

export async function getEventPayload() {
  const event = await ensureEvent();
  const address = getAddressState(event.publicBaseUrl);
  const participants = await prisma.participant.findMany({
    where: { eventId: event.id },
    include: { winners: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const hydrated = await Promise.all(
    participants.map(async ({ winners, ...participant }) => ({
      ...(await prepareParticipant(participant, address.url)),
      hasWon: participant.status === 'WON' || winners.length > 0,
    })),
  );
  const prizes = await prisma.prize.findMany({
    where: { eventId: event.id },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  });

  return {
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      currentRound: event.currentRound,
    },
    participants: hydrated,
    prizes,
    winner: getLatestWinner(),
    gossip: getGossip(),
    publicAddress: address,
  };
}
