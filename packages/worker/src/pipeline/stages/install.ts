import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WorkspaceInfo } from '@repoframe/shared';
import { appendLog } from '../context.js';

const execFileAsync = promisify(execFile);
const INSTALL_TIMEOUT = parseInt(process.env.INSTALL_TIMEOUT_MS || '120000', 10);

export async function installDeps(
  jobId: string,
  workspacePath: string,
  workspace: WorkspaceInfo
): Promise<void> {
  const projectDir = workspace.path;
  const pm = workspace.packageManager || 'npm';

  if (pm === 'unknown') {
    await appendLog(jobId, 'install.log', 'No package manager detected, skipping install');
    return;
  }

  const command = getInstallCommand(pm);
  await appendLog(jobId, 'install.log', `Running: ${command.cmd} ${command.args.join(' ')}`);
  await appendLog(jobId, 'pipeline.log', `[install] ${command.cmd} ${command.args.join(' ')} in ${projectDir}`);

  try {
    const { stdout, stderr } = await execFileAsync(command.cmd, command.args, {
      cwd: projectDir,
      timeout: INSTALL_TIMEOUT,
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        CI: 'true',
        NODE_ENV: 'development',
      },
    });

    if (stdout) await appendLog(jobId, 'install.log', stdout);
    if (stderr) await appendLog(jobId, 'install.log', stderr);
    await appendLog(jobId, 'pipeline.log', '[install] Dependencies installed successfully');
  } catch (err: any) {
    const output = (err.stdout || '') + '\n' + (err.stderr || '');
    await appendLog(jobId, 'install.log', output);

    const message = err.killed
      ? `Install timed out after ${INSTALL_TIMEOUT}ms`
      : `Install failed: ${err.message}`;
    await appendLog(jobId, 'install.log', `ERROR: ${message}`);
    throw new Error(message);
  }
}

function getInstallCommand(pm: string): { cmd: string; args: string[] } {
  switch (pm) {
    case 'pnpm':
      return { cmd: 'pnpm', args: ['install', '--no-frozen-lockfile'] };
    case 'yarn':
      return { cmd: 'yarn', args: ['install', '--non-interactive'] };
    case 'bun':
      return { cmd: 'bun', args: ['install'] };
    default:
      return { cmd: 'npm', args: ['install', '--legacy-peer-deps'] };
  }
}
