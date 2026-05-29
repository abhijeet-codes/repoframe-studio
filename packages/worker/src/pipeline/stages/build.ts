import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceInfo } from '@repoframe/shared';
import { appendLog } from '../context.js';

const execFileAsync = promisify(execFile);
const BUILD_TIMEOUT = parseInt(process.env.BUILD_TIMEOUT_MS || '180000', 10);

export async function buildProject(
  jobId: string,
  workspacePath: string,
  workspace: WorkspaceInfo
): Promise<void> {
  const projectDir = workspace.path;

  // If it's a static site, no build needed
  if (workspace.framework === 'static') {
    await appendLog(jobId, 'build.log', 'Static site detected, no build required');
    await appendLog(jobId, 'pipeline.log', '[build] Static site, skipping build');
    return;
  }

  if (!workspace.buildCommand) {
    await appendLog(jobId, 'build.log', 'No build command detected');
    await appendLog(jobId, 'pipeline.log', '[build] No build command, skipping');
    return;
  }

  const pm = workspace.packageManager || 'npm';
  const runCmd = pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : pm === 'bun' ? 'bun' : 'npm';
  const args = pm === 'yarn' ? [workspace.buildCommand] : ['run', workspace.buildCommand];

  await appendLog(jobId, 'build.log', `Running: ${runCmd} ${args.join(' ')}`);
  await appendLog(jobId, 'pipeline.log', `[build] ${runCmd} ${args.join(' ')} in ${projectDir}`);

  try {
    const { stdout, stderr } = await execFileAsync(runCmd, args, {
      cwd: projectDir,
      timeout: BUILD_TIMEOUT,
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        CI: 'true',
        NODE_ENV: 'production',
      },
    });

    if (stdout) await appendLog(jobId, 'build.log', stdout);
    if (stderr) await appendLog(jobId, 'build.log', stderr);
    await appendLog(jobId, 'pipeline.log', '[build] Build completed successfully');
  } catch (err: any) {
    const output = (err.stdout || '') + '\n' + (err.stderr || '');
    await appendLog(jobId, 'build.log', output);

    const message = err.killed
      ? `Build timed out after ${BUILD_TIMEOUT}ms`
      : `Build failed: ${err.message}`;
    await appendLog(jobId, 'build.log', `ERROR: ${message}`);
    throw new Error(message);
  }
}
