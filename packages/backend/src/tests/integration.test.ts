import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../server.js';
import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';

describe('Job Lifecycle Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.STORAGE_DIR = './data/test';
    process.env.JOBS_DIR = './data/test/jobs';
    process.env.WORKSPACES_DIR = './data/test/workspaces';
    process.env.ARTIFACTS_DIR = './data/test/artifacts';
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await fs.rm('./data/test', { recursive: true, force: true });
  });

  it('should create a job from GitHub URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        source: 'github',
        githubUrl: 'https://github.com/vitejs/vite',
        branch: 'main',
        mode: 'both',
      },
    });

    expect(res.statusCode).toBe(201);
    const job = JSON.parse(res.payload);
    expect(job.id).toBeDefined();
    expect(job.status).toBe('pending');
    expect(job.input.source).toBe('github');
    expect(job.stages).toHaveLength(9);
    expect(job.stages[0].name).toBe('clone');
  });

  it('should list jobs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs',
    });

    expect(res.statusCode).toBe(200);
    const jobs = JSON.parse(res.payload);
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('should get a specific job', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        source: 'github',
        githubUrl: 'https://github.com/facebook/react',
        mode: 'low-fi',
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await app.inject({
      method: 'GET',
      url: `/api/jobs/${created.id}`,
    });

    expect(res.statusCode).toBe(200);
    const job = JSON.parse(res.payload);
    expect(job.id).toBe(created.id);
  });

  it('should return 404 for non-existent job', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs/non-existent-id',
    });

    expect(res.statusCode).toBe(404);
  });

  it('should reject invalid job input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        source: 'github',
        mode: 'invalid-mode',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should delete a job', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        source: 'github',
        githubUrl: 'https://github.com/vuejs/vue',
        mode: 'both',
      },
    });
    const created = JSON.parse(createRes.payload);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/jobs/${created.id}`,
    });

    expect(deleteRes.statusCode).toBe(204);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/jobs/${created.id}`,
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('should serve health check', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
