import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPgPool, loadDatabaseState } from './server/stateStore.ts';
import {
  apiRateLimitMiddleware,
  corsAndCsrfMiddleware,
  loadServerSessions,
  securityHeadersMiddleware,
} from './server/security.ts';
import { createAuthRouter } from './server/routes/authRoutes.ts';
import { createDbSyncRouter } from './server/routes/dbSyncRoutes.ts';
import { createAdminRouter } from './server/routes/adminRoutes.ts';
import { createPatientsPayrollRouter } from './server/routes/patientsPayrollRoutes.ts';
import { createClinicalBillingRouter } from './server/routes/clinicalBillingRoutes.ts';
import { createOwnerRouter } from './server/routes/ownerRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createConfiguredApp(options?: { skipFrontend?: boolean }): Promise<express.Express> {
  await loadDatabaseState();
  await loadServerSessions();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Middlewares globales de seguridad, CORS/CSRF, Rate Limit y JSON body parsing
  app.use(securityHeadersMiddleware);
  app.use(corsAndCsrfMiddleware);
  app.use('/api/', apiRateLimitMiddleware);
  app.use(express.json({ limit: '25mb' }));

  // Rutas modulares de API Backend
  app.use('/api/auth', createAuthRouter());
  app.use('/api/owner', createOwnerRouter());
  app.use('/api', createDbSyncRouter());
  app.use('/api', createAdminRouter());
  app.use('/api', createPatientsPayrollRouter());
  app.use('/api', createClinicalBillingRouter());

  // Manejador centralizado de errores para /api/* (incluye JSON malformado y errores no controlados)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    const statusCode =
      typeof err?.status === 'number'
        ? err.status
        : typeof err?.statusCode === 'number'
          ? err.statusCode
          : 500;
    if (statusCode >= 500) {
      console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err?.message || err);
    }
    if (req.path.startsWith('/api/')) {
      return res.status(statusCode).json({
        error:
          statusCode === 400 && err?.type === 'entity.parse.failed'
            ? 'JSON inválido en el cuerpo de la solicitud.'
            : statusCode >= 500
              ? 'Error interno del servidor al procesar la solicitud.'
              : err?.message || 'Error al procesar la solicitud.',
      });
    }
    return res.status(statusCode).send('Error interno del servidor.');
  });

  if (options?.skipFrontend) {
    return app;
  }

  // Vite / Static Frontend Integration (lazy-import Vite only outside compiled dist production)
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, 'dist');
  if (!isProduction || !fs.existsSync(distPath)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath, { maxAge: '1h', index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      return res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL) {
      console.warn('[OdontoPro Security] WARN: NODE_ENV=production sin DATABASE_URL; operando en fallback local.');
    }
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
      console.warn('[OdontoPro Security] WARN: AUTH_SECRET no definido o menor a 32 caracteres.');
    }
  }
  const app = await createConfiguredApp();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OdontoPro Server] Running on http://0.0.0.0:${PORT}`);
  });

  let shuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[OdontoPro Server] Received ${signal}. Draining connections cleanly...`);

    const forceTimer = setTimeout(() => {
      console.error('[OdontoPro Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    server.close(async () => {
      try {
        const pool = getPgPool();
        if (pool) {
          await pool.end();
        }
      } catch (err) {
        console.error('[OdontoPro Server] Error closing PostgreSQL pool:', err);
      }
      clearTimeout(forceTimer);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
}

const isMainEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainEntry) {
  startServer().catch((err) => {
    console.error('[OdontoPro Server] Fatal startup error:', err);
    process.exit(1);
  });
}
