import dotenv from 'dotenv';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.resolve(backendRoot, '..', '.env') });

const port = Number(process.env.PORT ?? 3001);
const publicPort = Number(
  process.env.NODE_ENV === 'production' ? port : process.env.FRONTEND_PORT ?? 8080,
);
const networkAddress = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.'))
  .sort((left, right) => Number(right.address.startsWith('192.168.')) - Number(left.address.startsWith('192.168.')))
  .at(0)?.address;

export const config = {
  backendRoot,
  workspaceRoot: path.resolve(backendRoot, '..'),
  port,
  wifiBaseUrl: `http://${networkAddress ?? 'localhost'}:${publicPort}`,
  hostPin: process.env.HOST_PIN ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? '',
  publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() ?? '',
};

export function validateConfig() {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }
  if (!Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65535) {
    throw new Error('FRONTEND_PORT must be a valid TCP port.');
  }
  if (!config.hostPin) {
    throw new Error('HOST_PIN is required. Copy backend/.env.example to backend/.env and set the host PIN.');
  }
  if (config.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  if (config.publicBaseUrl) {
    const parsed = new URL(config.publicBaseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('PUBLIC_BASE_URL must be an HTTP(S) origin with no path, query, or credentials.');
    }
  }
}
