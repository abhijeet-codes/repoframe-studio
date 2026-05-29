import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { appendLog } from '../context.js';

const execFileAsync = promisify(execFile);
const CLONE_TIMEOUT = parseInt(process.env.CLONE_TIMEOUT_MS || '60000', 10);

export async function cloneRepo(
  jobId: string,
  githubUrl: string,
  branch: string | undefined,
  workspacePath: string
): Promise<void> {
  // Validate GitHub URL format
  const urlPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
  if (!urlPattern.test(githubUrl)) {
    throw new Error(`Invalid GitHub URL format: ${githubUrl}`);
  }

  const args = ['clone', '--depth', '1'];
  if (branch) {
    args.push('--branch', branch);
  }
  args.push(githubUrl, workspacePath);

  await appendLog(jobId, 'pipeline.log', `[clone] git ${args.join(' ')}`);

  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      timeout: CLONE_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stdout) await appendLog(jobId, 'pipeline.log', `[clone] ${stdout}`);
    if (stderr) await appendLog(jobId, 'pipeline.log', `[clone] ${stderr}`);
  } catch (err: any) {
    const message = err.killed
      ? `Clone timed out after ${CLONE_TIMEOUT}ms`
      : `Clone failed: ${err.stderr || err.message}`;
    await appendLog(jobId, 'pipeline.log', `[clone] ERROR: ${message}`);
    throw new Error(message);
  }
}
