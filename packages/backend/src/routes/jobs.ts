import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { CreateJobRequestSchema, Job, JobSchema } from '@repoframe/shared';
import { readJobFile, writeJobFile, listJobFiles, deleteJobFiles } from '../storage/filesystem.js';
import { enqueueJob } from '../services/queue.js';

export async function jobRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const parsed = CreateJobRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const input = parsed.data;
    const jobId = randomUUID();
    const now = new Date().toISOString();

    const job: Job = {
      id: jobId,
      input: {
        source: input.source,
        githubUrl: input.githubUrl,
        branch: input.branch,
        rootPath: input.rootPath,
        startCommand: input.startCommand,
        routeHints: input.routeHints,
        mode: input.mode,
      },
      status: 'pending',
      stages: [
        { name: input.source === 'github' ? 'clone' : 'extract', status: 'pending', warnings: [] },
        { name: 'detect', status: 'pending', warnings: [] },
        { name: 'install', status: 'pending', warnings: [] },
        { name: 'build', status: 'pending', warnings: [] },
        { name: 'discover', status: 'pending', warnings: [] },
        { name: 'render', status: 'pending', warnings: [] },
        { name: 'analyze', status: 'pending', warnings: [] },
        { name: 'generate', status: 'pending', warnings: [] },
        { name: 'export', status: 'pending', warnings: [] },
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

  app.get('/', async (request, reply) => {
    const jobIds = await listJobFiles();
    const jobs: Job[] = [];
    for (const id of jobIds) {
      try {
        const job = await readJobFile(id);
        jobs.push(job);
      } catch {
        // skip corrupted files
      }
    }
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return reply.send(jobs);
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const job = await readJobFile(request.params.id);
      return reply.send(job);
    } catch {
      return reply.status(404).send({ error: 'Job not found' });
    }
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      await deleteJobFiles(request.params.id);
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Job not found' });
    }
  });

  app.post<{ Params: { id: string; stage: string } }>('/:id/retry/:stage', async (request, reply) => {
    try {
      const job = await readJobFile(request.params.id);
      const stageIndex = job.stages.findIndex((s: any) => s.name === request.params.stage);
      if (stageIndex === -1) {
        return reply.status(400).send({ error: 'Invalid stage' });
      }

      // Reset this stage and all subsequent stages
      for (let i = stageIndex; i < job.stages.length; i++) {
        job.stages[i].status = 'pending';
        job.stages[i].error = undefined;
        job.stages[i].startedAt = undefined;
        job.stages[i].completedAt = undefined;
        job.stages[i].durationMs = undefined;
      }
      job.status = 'pending';
      job.updatedAt = new Date().toISOString();

      await writeJobFile(request.params.id, job);
      await enqueueJob(request.params.id);

      return reply.send(job);
    } catch {
      return reply.status(404).send({ error: 'Job not found' });
    }
  });
}
