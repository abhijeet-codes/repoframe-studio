import { FastifyInstance } from 'fastify';
import { readLog } from '../storage/filesystem.js';

export async function logRoutes(app: FastifyInstance) {
  app.get<{ Params: { jobId: string; logName: string } }>('/:jobId/:logName', async (request, reply) => {
    const { jobId, logName } = request.params;

    const validLogs = ['install.log', 'build.log', 'render.log', 'parser.log', 'error-summary.json', 'pipeline.log'];
    if (!validLogs.includes(logName)) {
      return reply.status(400).send({ error: 'Invalid log name' });
    }

    const content = await readLog(jobId, logName);
    if (!content) {
      return reply.status(404).send({ error: 'Log not found' });
    }

    reply.header('Content-Type', logName.endsWith('.json') ? 'application/json' : 'text/plain');
    return reply.send(content);
  });

  app.get<{ Params: { jobId: string } }>('/:jobId', async (request, reply) => {
    const { jobId } = request.params;
    const logs: Record<string, string> = {};
    const logNames = ['install.log', 'build.log', 'render.log', 'parser.log', 'pipeline.log'];

    for (const name of logNames) {
      const content = await readLog(jobId, name);
      if (content) {
        logs[name] = content;
      }
    }

    return reply.send(logs);
  });
}
