import type { Participant } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { prisma } from './db.js';
import { ensureEvent } from './events.js';

class SelectionConflictError extends Error {}

export async function pickWinner(
  removeWinner = false,
  prizeCategory: 'MINOR' | 'MAJOR' = 'MINOR',
): Promise<{
  participant: Participant;
  prize: { id: string; name: string; category: string } | null;
} | null> {
  const event = await ensureEvent();
  const roleFilter = prizeCategory === 'MAJOR' ? { role: 'EMPLOYEE' } : {};

  let active = await prisma.participant.findMany({
    where: { eventId: event.id, status: 'ACTIVE', ...roleFilter },
    orderBy: { activatedAt: 'asc' },
  });

  if (active.length === 0 && !removeWinner) {
    active = await prisma.participant.findMany({
      where: { eventId: event.id, status: { in: ['ACTIVE', 'WON'] }, ...roleFilter },
      orderBy: { activatedAt: 'asc' },
    });
  }

  if (active.length === 0) return null;

  const participant = active[randomInt(active.length)];

  try {
    await prisma.$transaction(async (tx) => {
      if (removeWinner) {
        const claimedParticipant = await tx.participant.updateMany({
          where: { id: participant.id, status: participant.status },
          data: { status: 'WON' },
        });
        if (claimedParticipant.count !== 1) {
          throw new SelectionConflictError();
        }
      }

      await tx.winner.create({
        data: {
          eventId: event.id,
          participantId: participant.id,
          roundNumber: event.currentRound,
        },
      });
      await tx.event.update({
        where: { id: event.id },
        data: { currentRound: { increment: 1 } },
      });
    });
  } catch (error) {
    if (error instanceof SelectionConflictError) return null;
    throw error;
  }

  return { participant, prize: null };
}
