import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import { listArtifacts, readArtifact, getArtifactsDir } from '../storage/filesystem.js';

export async function artifactRoutes(app: FastifyInstance) {
  app.get<{ Params: { jobId: string } }>('/:jobId', async (request, reply) => {
    const files = await listArtifacts(request.params.jobId);
    const artifacts = [];
    const artifactsDir = getArtifactsDir();

    for (const filename of files) {
      const filePath = path.join(artifactsDir, request.params.jobId, filename);
      try {
        const stat = await fs.stat(filePath);
        artifacts.push({
          filename,
          sizeBytes: stat.size,
          createdAt: stat.birthtime.toISOString(),
        });
      } catch {
        // skip
      }
    }

    return reply.send(artifacts);
  });

  app.get<{ Params: { jobId: string; filename: string } }>('/:jobId/:filename', async (request, reply) => {
    const { jobId, filename } = request.params;

    // Prevent directory traversal
    const sanitized = path.basename(filename);
    if (sanitized !== filename || filename.includes('..')) {
      return reply.status(400).send({ error: 'Invalid filename' });
    }

    try {
      const content = await readArtifact(jobId, sanitized);
      const ext = path.extname(sanitized).toLowerCase();

      const mimeTypes: Record<string, string> = {
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.html': 'text/html',
        '.pdf': 'application/pdf',
        '.log': 'text/plain',
        '.txt': 'text/plain',
      };

      reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      return reply.send(content);
    } catch {
      return reply.status(404).send({ error: 'Artifact not found' });
    }
  });

  app.get<{ Params: { jobId: string }; Querystring: { files?: string } }>(
    '/:jobId/download',
    async (request, reply) => {
      const { jobId } = request.params;
      const files = await listArtifacts(jobId);

      if (files.length === 0) {
        return reply.status(404).send({ error: 'No artifacts found' });
      }

      // For single file download, return the file directly
      // For multiple files, we'd need archiver but for MVP return file list
      return reply.send({
        jobId,
        files: files.map(f => `/api/artifacts/${jobId}/${f}`),
      });
    }
  );
}
