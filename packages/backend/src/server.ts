import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jobRoutes } from './routes/jobs.js';
import { uploadRoutes } from './routes/upload.js';
import { artifactRoutes } from './routes/artifacts.js';
import { logRoutes } from './routes/logs.js';
import { ensureDataDirs } from './storage/filesystem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    bodyLimit: 1024 * 1024 * 110,
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: {
      fileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '100', 10)) * 1024 * 1024,
    },
  });
  await app.register(websocket);

  const dataDir = path.resolve(process.env.STORAGE_DIR || './data');
  const artifactsDir = path.resolve(process.env.ARTIFACTS_DIR || './data/artifacts');
  
  await ensureDataDirs();

  await app.register(fastifyStatic, {
    root: artifactsDir,
    prefix: '/static/',
    decorateReply: true,
  });

  await app.register(jobRoutes, { prefix: '/api/jobs' });
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(artifactRoutes, { prefix: '/api/artifacts' });
  await app.register(logRoutes, { prefix: '/api/logs' });

  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return app;
}
