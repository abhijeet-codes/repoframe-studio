import fs from 'node:fs/promises';
import path from 'node:path';
import { Job, PipelineStage, PipelineStageName } from '@repoframe/shared';

const JOBS_DIR = path.resolve(process.env.JOBS_DIR || './data/jobs');
const WORKSPACES_DIR = path.resolve(process.env.WORKSPACES_DIR || './data/workspaces');
const ARTIFACTS_DIR = path.resolve(process.env.ARTIFACTS_DIR || './data/artifacts');

export async function readJob(jobId: string): Promise<Job> {
  const filePath = path.join(JOBS_DIR, `${jobId}.json`);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

export async function writeJob(jobId: string, job: Job): Promise<void> {
  const filePath = path.join(JOBS_DIR, `${jobId}.json`);
  await fs.writeFile(filePath, JSON.stringify(job, null, 2), 'utf-8');
}

export async function updateStage(
  jobId: string,
  stageName: PipelineStageName,
  update: Partial<PipelineStage>
): Promise<Job> {
  const job = await readJob(jobId);
  const stage = job.stages.find(s => s.name === stageName);
  if (stage) {
    Object.assign(stage, update);
  }
  job.updatedAt = new Date().toISOString();
  await writeJob(jobId, job);
  return job;
}

export async function markStageRunning(jobId: string, stageName: PipelineStageName): Promise<Job> {
  return updateStage(jobId, stageName, {
    status: 'running',
    startedAt: new Date().toISOString(),
  });
}

export async function markStageSuccess(jobId: string, stageName: PipelineStageName): Promise<Job> {
  const job = await readJob(jobId);
  const stage = job.stages.find(s => s.name === stageName);
  if (stage) {
    stage.status = 'success';
    stage.completedAt = new Date().toISOString();
    if (stage.startedAt) {
      stage.durationMs = new Date(stage.completedAt).getTime() - new Date(stage.startedAt).getTime();
    }
  }
  job.updatedAt = new Date().toISOString();
  await writeJob(jobId, job);
  return job;
}

export async function markStageFailed(jobId: string, stageName: PipelineStageName, error: string): Promise<Job> {
  const job = await readJob(jobId);
  const stage = job.stages.find(s => s.name === stageName);
  if (stage) {
    stage.status = 'failed';
    stage.error = error;
    stage.completedAt = new Date().toISOString();
    if (stage.startedAt) {
      stage.durationMs = new Date(stage.completedAt).getTime() - new Date(stage.startedAt).getTime();
    }
  }
  job.status = 'failed';
  job.errorSummary = error;
  job.updatedAt = new Date().toISOString();
  await writeJob(jobId, job);
  return job;
}

export async function markStageWarning(jobId: string, stageName: PipelineStageName, warning: string): Promise<Job> {
  const job = await readJob(jobId);
  const stage = job.stages.find(s => s.name === stageName);
  if (stage) {
    stage.status = 'warning';
    stage.warnings.push(warning);
    stage.completedAt = new Date().toISOString();
    if (stage.startedAt) {
      stage.durationMs = new Date(stage.completedAt).getTime() - new Date(stage.startedAt).getTime();
    }
  }
  job.updatedAt = new Date().toISOString();
  await writeJob(jobId, job);
  return job;
}

export function getWorkspacePath(jobId: string): string {
  return path.join(WORKSPACES_DIR, jobId);
}

export function getArtifactsPath(jobId: string): string {
  return path.join(ARTIFACTS_DIR, jobId);
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function appendLog(jobId: string, logName: string, content: string): Promise<void> {
  const dir = path.join(ARTIFACTS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, logName), content + '\n');
}

export async function writeArtifactFile(jobId: string, filename: string, content: string | Buffer): Promise<string> {
  const dir = path.join(ARTIFACTS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content);
  return filePath;
}
