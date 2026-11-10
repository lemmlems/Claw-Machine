import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { PrismaClient, type Event, type Participant } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT ?? 3000);
const publicPort = Number(process.env.PUBLIC_PORT ?? port);
const networkAddress = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.'))
  .sort((left, right) => Number(right.address.startsWith('192.168.')) - Number(left.address.startsWith('192.168.')))
  .at(0)?.address;
const wifiBaseUrl = `http://${networkAddress ?? 'localhost'}:${publicPort}`;
const clients = new Set<Response>();

let latestWinner: { participantName: string; message: string } | null = null;
const gossipFeed: string[] = [];

type ParticipantWithQr = Participant & {
  invitationUrl: string;
  qrCode: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');
const distIndex = path.join(workspaceRoot, 'dist', 'client', 'index.html');

function getAddressState(storedAddress?: string | null) {
  const url = storedAddress ?? process.env.PUBLIC_BASE_URL?.trim() ?? wifiBaseUrl;
  const hostname = new URL(url).hostname.toLowerCase();
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  return {
    url,
    isLocal,
    mode: isLocal ? 'local' : url === wifiBaseUrl ? 'wifi' : 'public',
  };
}

async function prepareParticipant(participant: Participant, baseUrl: string): Promise<ParticipantWithQr> {
  const invitationUrl = `${baseUrl}/activate/${participant.activationToken}`;
  const qrCode = await QRCode.toDataURL(invitationUrl, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: 'M',
  });

  return {
    ...participant,
    invitationUrl,
    qrCode,
  };
}

async function ensureEvent(): Promise<Event> {
  let event = await prisma.event.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (!event) {
    const pepper = process.env.HOST_PIN_PEPPER ?? 'development-pepper';
    event = await prisma.event.create({
      data: {
        name: "The Ton's Claw",
        status: 'OPEN',
        hostTokenHash: createHash('sha256').update(`host:${Date.now()}`).digest('hex'),
        hostPinHash: createHash('sha256').update(`pin:${pepper}`).digest('hex'),
        removeWinnerAfterPick: true,
        currentRound: 1,
      },
    });
  }

  return event;
}

async function getEventPayload() {
  const event = await ensureEvent();
  const address = getAddressState(event.publicBaseUrl);
  const participants = await prisma.participant.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'asc' },
  });

  const hydrated = await Promise.all(participants.map((participant) => prepareParticipant(participant, address.url)));

  return {
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      currentRound: event.currentRound,
    },
    participants: hydrated,
    winner: latestWinner,
    gossip: gossipFeed.slice(0, 6),
    publicAddress: address,
  };
}

async function broadcastState() {
  const payload = await getEventPayload();
  const data = `data: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    client.write(`event: state\n${data}`);
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, app: "The Ton's Claw" });
});

app.get('/api/event', async (_req: Request, res: Response) => {
  const payload = await getEventPayload();
  res.json(payload);
});

app.post('/api/settings/public-address', async (req: Request, res: Response) => {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  let publicBaseUrl: string;

  try {
    const parsedUrl = new URL(rawUrl);
    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.pathname !== '/' ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new Error('Invalid public address');
    }

    publicBaseUrl = parsedUrl.origin;
  } catch {
    return res.status(400).json({
      message: 'Please enter a complete address beginning with http:// or https://.',
    });
  }

  const event = await ensureEvent();
  await prisma.event.update({
    where: { id: event.id },
    data: { publicBaseUrl },
  });

  await broadcastState();
  return res.json({ ok: true, publicAddress: getAddressState(publicBaseUrl) });
});

app.post('/api/settings/use-wifi-address', async (_req: Request, res: Response) => {
  const event = await ensureEvent();
  await prisma.event.update({
    where: { id: event.id },
    data: { publicBaseUrl: wifiBaseUrl },
  });

  await broadcastState();
  return res.json({ ok: true, publicAddress: getAddressState(wifiBaseUrl) });
});

app.get('/api/events/stream', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  clients.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  _req.on('close', () => {
    clients.delete(res);
  });
});

app.post('/api/participants', async (req: Request, res: Response) => {
  const rawName = String(req.body?.name ?? '').trim();
  if (!rawName) {
    return res.status(400).json({ message: 'Please add a name for the guest.' });
  }

  const event = await ensureEvent();
  const cleanName = rawName.slice(0, 25).trim();
  const nameKey = cleanName.toLowerCase();

  const existing = await prisma.participant.findFirst({
    where: { eventId: event.id, nameKey },
  });

  if (existing) {
    return res.status(409).json({ message: 'This guest already has an invitation in the ledger.' });
  }

  const activationToken = randomBytes(32).toString('base64url');
  const participant = await prisma.participant.create({
    data: {
      eventId: event.id,
      name: cleanName,
      nameKey,
      activationToken,
      status: 'INACTIVE',
    },
  });

  const combined = await prepareParticipant(participant, getAddressState(event.publicBaseUrl).url);
  gossipFeed.unshift(`Dearest guests, ${cleanName} has been invited to the ball.`);
  if (gossipFeed.length > 6) gossipFeed.pop();

  await broadcastState();

  return res.status(201).json({
    ...combined,
    message: `Invitation prepared for ${cleanName}.`,
  });
});

app.post('/api/events/select-winner', async (_req: Request, res: Response) => {
  const event = await ensureEvent();
  const active = await prisma.participant.findMany({
    where: {
      eventId: event.id,
      status: 'ACTIVE',
    },
    orderBy: { activatedAt: 'asc' },
  });

  if (active.length === 0) {
    return res.status(400).json({ message: 'No guests have arrived yet. The ballroom awaits.' });
  }

  const winner = active[Math.floor(Math.random() * active.length)];

  await prisma.$transaction(async (tx) => {
    await tx.participant.update({
      where: { id: winner.id },
      data: { status: 'WON' },
    });

    await tx.winner.create({
      data: {
        eventId: event.id,
        participantId: winner.id,
        roundNumber: event.currentRound,
      },
    });

    await tx.event.update({
      where: { id: event.id },
      data: {
        currentRound: event.currentRound + 1,
      },
    });
  });

  latestWinner = {
    participantName: winner.name,
    message: 'Darling, you are the Diamond of the Season! 💎',
  };

  gossipFeed.unshift(`Dearest guests, the claw has chosen ${winner.name}.`);
  if (gossipFeed.length > 6) gossipFeed.pop();

  await broadcastState();

  return res.json({
    ok: true,
    winner: {
      participantName: winner.name,
      message: latestWinner.message,
    },
  });
});

app.get('/api/activate/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  const participant = await prisma.participant.findUnique({
    where: { activationToken: token },
  });

  if (!participant) {
    return res.status(404).json({
      valid: false,
      message: 'This invitation is not valid, or the ball has closed. Pray, ask your host.',
    });
  }

  const event = await prisma.event.findUnique({ where: { id: participant.eventId } });
  if (!event || event.status !== 'OPEN') {
    return res.json({
      valid: false,
      message: 'This invitation is not valid, or the ball has closed. Pray, ask your host.',
    });
  }

  if (participant.status === 'WON') {
    return res.json({
      valid: true,
      status: 'already-won',
      message: 'You have already been chosen this evening.',
      participant: { name: participant.name },
    });
  }

  if (participant.status === 'ACTIVE') {
    return res.json({
      valid: true,
      status: 'already',
      message: `You have already arrived, ${participant.name}. Do enjoy the evening.`,
      participant: { name: participant.name },
    });
  }

  const updatedParticipant = await prisma.participant.update({
    where: { id: participant.id },
    data: {
      status: 'ACTIVE',
      activatedAt: new Date(),
    },
  });

  gossipFeed.unshift(`Dearest guests, ${updatedParticipant.name} has just arrived.`);
  if (gossipFeed.length > 6) gossipFeed.pop();

  await broadcastState();

  return res.json({
    valid: true,
    status: 'activated',
    message: `Welcome to the ball, ${updatedParticipant.name}! 🎉 Do take your place and watch the grand display.`,
    participant: { name: updatedParticipant.name },
  });
});

app.get('/activate/:token', (_req: Request, res: Response) => {
  const file = fs.existsSync(distIndex) ? distIndex : path.join(workspaceRoot, 'index.html');
  res.sendFile(file);
});

if (fs.existsSync(distIndex)) {
  app.use(express.static(path.join(workspaceRoot, 'dist', 'client')));
}

app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
  const file = fs.existsSync(distIndex) ? distIndex : path.join(workspaceRoot, 'index.html');
  res.sendFile(file);
});

async function start() {
  await ensureEvent();
  const configuredPublicAddress = process.env.PUBLIC_BASE_URL?.trim();
  if (configuredPublicAddress) {
    try {
      const parsed = new URL(configuredPublicAddress);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('PUBLIC_BASE_URL must use HTTP or HTTPS.');
      }
    } catch (error) {
      console.error('PUBLIC_BASE_URL is invalid. Use a complete http:// or https:// address.', error);
      process.exitCode = 1;
      return;
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`The Ton's Claw is running on http://localhost:${port}`);
    console.log(`Phones on the same Wi-Fi can open: ${wifiBaseUrl}`);
  });
}

void start();
