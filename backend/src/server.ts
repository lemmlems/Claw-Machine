import { config, validateConfig } from './config.js';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { apiRouter } from './routes.js';
import { prisma } from './db.js';

const app = express();
const frontendDist = path.join(config.workspaceRoot, 'frontend', 'dist');
const frontendIndex = path.join(frontendDist, 'index.html');
const clawPage = path.join(config.workspaceRoot, 'frontend', 'public', 'claw.html');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    },
  },
}));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRouter);

const clawPageSecurity = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    },
  },
});

app.get(['/claw', '/claw.html'], clawPageSecurity, (_req, res, next) => {
  res.sendFile(clawPage, (error) => {
    if (error) next(error);
  });
});

if (process.env.NODE_ENV === 'production' && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(frontendIndex);
  });
} else {
  app.get('/activate/:token', (req, res) => {
    res.redirect(302, `/?activation=${encodeURIComponent(req.params.token)}`);
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled request error:', error);
  if (!res.headersSent) {
    res.status(500).json({ message: 'An unexpected server error occurred.' });
  }
});

async function start() {
  validateConfig();
  await prisma.$connect();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`The Ton's Claw API is running on http://localhost:${config.port}`);
    console.log(`Phones on the same Wi-Fi can open: ${config.wifiBaseUrl}`);
  });
}

void start().catch((error: unknown) => {
  console.error('Unable to start The Ton\'s Claw:', error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}
