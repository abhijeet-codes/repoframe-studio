import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendLog } from '../context.js';

const execFileAsync = promisify(execFile);
const MAX_UNZIP_SIZE = (parseInt(process.env.MAX_UNZIP_SIZE_MB || '500', 10)) * 1024 * 1024;

export async function extractZip(jobId: string, workspacePath: string): Promise<void> {
  // Find the zip file in the workspace
  const files = await fs.readdir(workspacePath);
  const zipFile = files.find(f => f.endsWith('.zip'));

  if (!zipFile) {
    throw new Error('No ZIP file found in workspace');
  }

  const zipPath = path.join(workspacePath, zipFile);
  const extractDir = path.join(workspacePath, '_extracted');

  await appendLog(jobId, 'pipeline.log', `[extract] Extracting ${zipFile}`);

  // Check file size
  const stat = await fs.stat(zipPath);
  if (stat.size > MAX_UNZIP_SIZE) {
    throw new Error(`ZIP file too large: ${stat.size} bytes (max ${MAX_UNZIP_SIZE})`);
  }

  // Use system unzip with security checks
  try {
    await fs.mkdir(extractDir, { recursive: true });

    const { stdout, stderr } = await execFileAsync('unzip', ['-o', '-d', extractDir, zipPath], {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stdout) await appendLog(jobId, 'pipeline.log', `[extract] ${stdout.slice(0, 2000)}`);
    if (stderr) await appendLog(jobId, 'pipeline.log', `[extract] ${stderr.slice(0, 2000)}`);
  } catch (err: any) {
    throw new Error(`Extraction failed: ${err.message}`);
  }

  // Verify no zip-slip (directory traversal)
  await verifyExtractedPaths(extractDir, extractDir);

  // Move extracted contents to workspace root
  const extractedContents = await fs.readdir(extractDir);

  // If there's a single directory, use its contents
  if (extractedContents.length === 1) {
    const singleDir = path.join(extractDir, extractedContents[0]);
    const stat = await fs.stat(singleDir);
    if (stat.isDirectory()) {
      const innerFiles = await fs.readdir(singleDir);
      for (const file of innerFiles) {
        await fs.rename(path.join(singleDir, file), path.join(workspacePath, file));
      }
      await fs.rm(extractDir, { recursive: true, force: true });
      await fs.rm(zipPath, { force: true });
      return;
    }
  }

  // Move all extracted files
  for (const file of extractedContents) {
    await fs.rename(path.join(extractDir, file), path.join(workspacePath, file));
  }
  await fs.rm(extractDir, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });

  await appendLog(jobId, 'pipeline.log', `[extract] Extraction complete`);
}

async function verifyExtractedPaths(baseDir: string, currentDir: string): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const resolvedBase = await fs.realpath(baseDir);

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const resolved = path.resolve(entryPath);

    // Zip-slip prevention
    if (!resolved.startsWith(resolvedBase)) {
      throw new Error(`Zip-slip detected: ${entry.name} resolves outside extraction directory`);
    }

    // Prevent suspicious filenames
    if (entry.name.includes('..') || entry.name.startsWith('/')) {
      throw new Error(`Suspicious filename detected: ${entry.name}`);
    }

    if (entry.isDirectory()) {
      await verifyExtractedPaths(baseDir, entryPath);
    }
  }
}
