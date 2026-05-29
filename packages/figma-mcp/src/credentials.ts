import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface RepoFrameCredentials {
  figma?: {
    personalAccessToken: string;
    teamId?: string;
    projectId?: string;
  };
}

const CREDENTIALS_FILENAME = '.repoframe/credentials.json';

function getCredentialsPath(): string {
  // Store in the project root (local repo) if we can detect it,
  // otherwise fall back to home directory
  const projectRoot = process.env.REPOFRAME_PROJECT_ROOT
    || process.env.INIT_CWD
    || process.cwd();

  return path.join(projectRoot, CREDENTIALS_FILENAME);
}

export async function loadCredentials(): Promise<RepoFrameCredentials> {
  const credPath = getCredentialsPath();
  try {
    const raw = await fs.readFile(credPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveCredentials(credentials: RepoFrameCredentials): Promise<string> {
  const credPath = getCredentialsPath();
  await fs.mkdir(path.dirname(credPath), { recursive: true });
  await fs.writeFile(credPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  return credPath;
}

export async function getFigmaToken(): Promise<string | null> {
  // Priority: env var > stored credentials
  if (process.env.FIGMA_PERSONAL_ACCESS_TOKEN) {
    return process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
  }
  const creds = await loadCredentials();
  return creds.figma?.personalAccessToken || null;
}

export async function clearCredentials(): Promise<void> {
  const credPath = getCredentialsPath();
  try {
    await fs.unlink(credPath);
  } catch {}
}
