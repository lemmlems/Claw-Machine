import express, { type Request, type Response, type RequestHandler } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { authRouter, requireHost } from './auth.js';
import { getAddressState } from './address.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { ensureEvent, getEventPayload } from './events.js';
import { pickWinner } from './pick.js';
import { prepareParticipant } from './qr.js';
import { broadcastState, handleEventStream } from './sse.js';
import { addGossip, setLatestWinner } from './state.js';

const participantSchema = z.object({
  name: z.string().trim().min(1),
  role: z.enum(['EMPLOYEE', 'INTERN']).default('INTERN'),
});
const participantRoleSchema = z.object({ role: z.enum(['EMPLOYEE', 'INTERN']) });
const prizeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(['MINOR', 'MAJOR']),
  description: z.string().trim().max(200).default(''),
  remaining: z.number().int().min(0).max(1000),
});
const newPrizeSchema = prizeSchema.extend({ remaining: z.number().int().min(1).max(1000) });
const addressSchema = z.string().url().transform((value, context) => {
  const parsed = new URL(value);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter an HTTP(S) origin without a path.' });
    return z.NEVER;
  }
  return parsed.origin;
});

function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

export const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, app: "The Ton's Claw" });
});

apiRouter.use('/auth', authRouter);

apiRouter.get('/activate/:token', asyncRoute(async (req, res) => {
  const participant = await prisma.participant.findUnique({
    where: { activationToken: req.params.token },
  });
  if (!participant) {
    res.status(404).json({
      valid: false,
      message: 'This invitation is not valid, or the ball has closed. Pray, ask your host.',
    });
    return;
  }

  const event = await prisma.event.findUnique({ where: { id: participant.eventId } });
  if (!event || event.status !== 'OPEN') {
    res.json({
      valid: false,
      message: 'This invitation is not valid, or the ball has closed. Pray, ask your host.',
    });
    return;
  }

  if (participant.status === 'WON') {
    res.json({
      valid: true,
      status: 'already-won',
      message: 'You have already been chosen this evening.',
      participant: { name: participant.name },
    });
    return;
  }

  if (participant.status === 'ACTIVE') {
    res.json({
      valid: true,
      status: 'already',
      message: `You have already arrived, ${participant.name}. Do enjoy the evening.`,
      participant: { name: participant.name },
    });
    return;
  }

  const updatedParticipant = await prisma.participant.update({
    where: { id: participant.id },
    data: { status: 'ACTIVE', activatedAt: new Date() },
  });
  addGossip(`Dearest guests, ${updatedParticipant.name} has just arrived.`);
  broadcastState(await getEventPayload());
  res.json({
    valid: true,
    status: 'activated',
    message: `Welcome to the ball, ${updatedParticipant.name}! 🎉 Do take your place and watch the grand display.`,
    participant: { name: updatedParticipant.name },
  });
}));

apiRouter.use(requireHost);

apiRouter.get('/event', asyncRoute(async (_req, res) => {
  res.json(await getEventPayload());
}));

apiRouter.get('/events/stream', handleEventStream);

apiRouter.post('/prizes', asyncRoute(async (req, res) => {
  const parsed = newPrizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Enter a prize name and a valid quantity.' });
    return;
  }
  const event = await ensureEvent();
  const prize = await prisma.prize.create({ data: { ...parsed.data, eventId: event.id } });
  broadcastState(await getEventPayload());
  res.status(201).json({ prize });
}));

apiRouter.put('/prizes/:id', asyncRoute(async (req, res) => {
  const parsed = prizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Enter a prize name and a valid quantity.' });
    return;
  }
  const event = await ensureEvent();
  const updated = await prisma.prize.updateMany({
    where: { id: req.params.id, eventId: event.id },
    data: parsed.data,
  });
  if (updated.count !== 1) {
    res.status(404).json({ message: 'That prize could not be found.' });
    return;
  }
  broadcastState(await getEventPayload());
  res.json({ ok: true });
}));

apiRouter.delete('/prizes/:id', asyncRoute(async (req, res) => {
  const event = await ensureEvent();
  const deleted = await prisma.prize.deleteMany({
    where: { id: req.params.id, eventId: event.id },
  });
  if (deleted.count !== 1) {
    res.status(404).json({ message: 'That prize could not be found.' });
    return;
  }
  broadcastState(await getEventPayload());
  res.json({ ok: true });
}));

apiRouter.post('/settings/public-address', asyncRoute(async (req, res) => {
  const parsed = addressSchema.safeParse(req.body?.url);
  if (!parsed.success) {
    res.status(400).json({
      message: 'Please enter a complete address beginning with http:// or https://.',
    });
    return;
  }

  const event = await ensureEvent();
  await prisma.event.update({
    where: { id: event.id },
    data: { publicBaseUrl: parsed.data },
  });
  broadcastState(await getEventPayload());
  res.json({ ok: true, publicAddress: getAddressState(parsed.data) });
}));

apiRouter.post('/settings/use-wifi-address', asyncRoute(async (_req, res) => {
  const event = await ensureEvent();
  await prisma.event.update({
    where: { id: event.id },
    data: { publicBaseUrl: config.wifiBaseUrl },
  });
  broadcastState(await getEventPayload());
  res.json({ ok: true, publicAddress: getAddressState(config.wifiBaseUrl) });
}));

apiRouter.post('/participants', asyncRoute(async (req, res) => {
  const parsed = participantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Please add a name for the guest.' });
    return;
  }

  const event = await ensureEvent();
  const cleanName = parsed.data.name;
  const nameKey = cleanName.toLowerCase();
  const existing = await prisma.participant.findFirst({ where: { eventId: event.id, nameKey } });
  if (existing) {
    res.status(409).json({ message: 'This guest already has an invitation in the ledger.' });
    return;
  }

  const participant = await prisma.participant.create({
    data: {
      eventId: event.id,
      name: cleanName,
      nameKey,
      role: parsed.data.role,
      activationToken: randomBytes(32).toString('base64url'),
      status: 'INACTIVE',
    },
  });
  const combined = await prepareParticipant(participant, getAddressState(event.publicBaseUrl).url);
  addGossip(`Dearest guests, ${cleanName} has been invited to the ball.`);
  broadcastState(await getEventPayload());
  res.status(201).json({ ...combined, message: `Invitation prepared for ${cleanName}.` });
}));

apiRouter.patch('/participants/:id/role', asyncRoute(async (req, res) => {
  const parsed = participantRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Choose Employee or Intern for this guest.' });
    return;
  }
  const event = await ensureEvent();
  const updated = await prisma.participant.updateMany({
    where: { id: req.params.id, eventId: event.id },
    data: { role: parsed.data.role },
  });
  if (updated.count !== 1) {
    res.status(404).json({ message: 'That guest could not be found.' });
    return;
  }
  broadcastState(await getEventPayload());
  res.json({ ok: true });
}));

apiRouter.post('/events/reset-pool', asyncRoute(async (_req, res) => {
  const event = await ensureEvent();
  await prisma.participant.updateMany({
    where: { eventId: event.id, status: 'WON' },
    data: { status: 'ACTIVE' },
  });
  const payload = await getEventPayload();
  broadcastState(payload);
  res.json(payload);
}));

apiRouter.post('/events/select-winner', asyncRoute(async (req, res) => {
  const removeWinner = req.body?.removeWinner === true;
  const prizeCategory = req.body?.prizeCategory === 'MAJOR' ? 'MAJOR' : 'MINOR';
  const result = await pickWinner(removeWinner, prizeCategory);
  if (!result) {
    res.status(400).json({
      message: prizeCategory === 'MAJOR'
        ? 'No eligible arrived employees are in the pool for a Major Prize.'
        : 'No guests have arrived yet. The ballroom awaits.',
    });
    return;
  }

  const { participant } = result;
  const label = prizeCategory === 'MAJOR' ? 'Major Prize' : 'Minor Prize';
  const message = `${label} · Darling, you are the Diamond of the Season! 💎`;
  const announcement = {
    participantId: participant.id,
    participantName: participant.name,
    prizeName: label,
    prizeCategory,
    message,
  };
  setLatestWinner(announcement);
  addGossip(`Dearest guests, the claw has chosen ${participant.name} for a ${label}.`);
  broadcastState(await getEventPayload());
  res.json({ ok: true, winner: announcement });
}));
