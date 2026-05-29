import fs from 'node:fs/promises';
import path from 'node:path';

const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || './data');
const JOBS_DIR = path.resolve(process.env.JOBS_DIR || './data/jobs');
const WORKSPACES_DIR = path.resolve(process.env.WORKSPACES_DIR || './data/workspaces');
const ARTIFACTS_DIR = path.resolve(process.env.ARTIFACTS_DIR || './data/artifacts');

export async function ensureDataDirs() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(WORKSPACES_DIR, { recursive: true });
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
}

export function getJobsDir() { return JOBS_DIR; }
export function getWorkspacesDir() { return WORKSPACES_DIR; }
export function getArtifactsDir() { return ARTIFACTS_DIR; }

export async function readJobFile(jobId: string) {
  const filePath = path.join(JOBS_DIR, `${jobId}.json`);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

export async function writeJobFile(jobId: string, data: unknown) {
  const filePath = path.join(JOBS_DIR, `${jobId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function listJobFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(JOBS_DIR);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

export async function deleteJobFiles(jobId: string) {
  const jobFile = path.join(JOBS_DIR, `${jobId}.json`);
  const workspaceDir = path.join(WORKSPACES_DIR, jobId);
  const artifactDir = path.join(ARTIFACTS_DIR, jobId);

  await fs.rm(jobFile, { force: true });
  await fs.rm(workspaceDir, { recursive: true, force: true });
  await fs.rm(artifactDir, { recursive: true, force: true });
}

export async function ensureJobArtifactDir(jobId: string): Promise<string> {
  const dir = path.join(ARTIFACTS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureJobWorkspaceDir(jobId: string): Promise<string> {
  const dir = path.join(WORKSPACES_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeArtifact(jobId: string, filename: string, content: Buffer | string): Promise<string> {
  const dir = await ensureJobArtifactDir(jobId);
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content);
  return filePath;
}

export async function readArtifact(jobId: string, filename: string): Promise<Buffer> {
  const filePath = path.join(ARTIFACTS_DIR, jobId, filename);
  return fs.readFile(filePath);
}

export async function listArtifacts(jobId: string): Promise<string[]> {
  const dir = path.join(ARTIFACTS_DIR, jobId);
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function writeLog(jobId: string, logName: string, content: string): Promise<string> {
  const dir = await ensureJobArtifactDir(jobId);
  const filePath = path.join(dir, logName);
  await fs.appendFile(filePath, content + '\n');
  return filePath;
}

export async function readLog(jobId: string, logName: string): Promise<string> {
  const filePath = path.join(ARTIFACTS_DIR, jobId, logName);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}
