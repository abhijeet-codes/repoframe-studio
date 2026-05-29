import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ensureJobWorkspaceDir, writeJobFile, readJobFile } from '../storage/filesystem.js';
import { enqueueJob } from '../services/queue.js';

const MAX_UPLOAD_SIZE = (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '100', 10)) * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/zip', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const filename = sanitizeFilename(data.filename);
    if (!filename.endsWith('.zip')) {
      return reply.status(400).send({ error: 'Only ZIP files are accepted' });
    }

    const jobId = randomUUID();
    const workspaceDir = await ensureJobWorkspaceDir(jobId);
    const zipPath = path.join(workspaceDir, filename);

    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of data.file) {
      totalSize += chunk.length;
      if (totalSize > MAX_UPLOAD_SIZE) {
        return reply.status(413).send({ error: `File exceeds maximum size of ${process.env.MAX_UPLOAD_SIZE_MB || 100}MB` });
      }
      chunks.push(chunk);
    }

    await fs.writeFile(zipPath, Buffer.concat(chunks));

    const modeParam = (request.query as any)?.mode || 'both';
    const rootPath = (request.query as any)?.rootPath;
    const startCommand = (request.query as any)?.startCommand;
    const routeHints = (request.query as any)?.routeHints;

    const now = new Date().toISOString();
    const job = {
      id: jobId,
      input: {
        source: 'zip' as const,
        zipFileName: filename,
        rootPath,
        startCommand,
        routeHints: routeHints ? routeHints.split(',') : undefined,
        mode: modeParam,
      },
      status: 'pending' as const,
      stages: [
        { name: 'extract' as const, status: 'pending' as const, warnings: [] },
        { name: 'detect' as const, status: 'pending' as const, warnings: [] },
        { name: 'install' as const, status: 'pending' as const, warnings: [] },
        { name: 'build' as const, status: 'pending' as const, warnings: [] },
        { name: 'discover' as const, status: 'pending' as const, warnings: [] },
        { name: 'render' as const, status: 'pending' as const, warnings: [] },
        { name: 'analyze' as const, status: 'pending' as const, warnings: [] },
        { name: 'generate' as const, status: 'pending' as const, warnings: [] },
        { name: 'export' as const, status: 'pending' as const, warnings: [] },
      ],
      routes: [],
      artifacts: [],
      createdAt: now,
      updatedAt: now,
    };

    await writeJobFile(jobId, job);
    await enqueueJob(jobId);

    return reply.status(201).send(job);
  });
}
