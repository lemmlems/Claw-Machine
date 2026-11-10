import type { Request, Response } from 'express';

const clients = new Set<Response>();

export function handleEventStream(_req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  clients.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  res.on('close', () => clients.delete(res));
}

export function broadcastState(payload: unknown) {
  const data = `event: state\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(data);
    } catch (error) {
      clients.delete(client);
      console.error('Unable to broadcast state to a connected dashboard:', error);
    }
  }
}
