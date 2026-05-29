import { Job } from '@repoframe/shared';
import {
  readJob, writeJob, markStageRunning, markStageSuccess,
  markStageFailed, getWorkspacePath, getArtifactsPath,
  ensureDir, appendLog, writeArtifactFile,
} from './context.js';
import { cloneRepo } from './stages/clone.js';
import { extractZip } from './stages/extract.js';
import { detectFramework } from './stages/detect.js';
import { installDeps } from './stages/install.js';
import { buildProject } from './stages/build.js';
import { discoverRoutes } from './stages/discover.js';
import { renderRoutes } from './stages/render.js';
import { analyzeDOM } from './stages/analyze.js';
import { generateWireframes } from './stages/generate.js';
import { exportArtifacts } from './stages/export.js';

export async function runPipeline(jobId: string): Promise<void> {
  let job = await readJob(jobId);
  const workspacePath = getWorkspacePath(jobId);
  const artifactsPath = getArtifactsPath(jobId);

  await ensureDir(workspacePath);
  await ensureDir(artifactsPath);

  // Update job status
  job.status = job.input.source === 'github' ? 'cloning' : 'extracting';
  job.updatedAt = new Date().toISOString();
  await writeJob(jobId, job);

  const stageName = job.input.source === 'github' ? 'clone' : 'extract';

  try {
    // Stage 1: Clone or Extract
    await markStageRunning(jobId, stageName);
    if (job.input.source === 'github') {
      await cloneRepo(jobId, job.input.githubUrl!, job.input.branch, workspacePath);
    } else {
      await extractZip(jobId, workspacePath);
    }
    await markStageSuccess(jobId, stageName);
  } catch (err: any) {
    await markStageFailed(jobId, stageName, err.message);
    await appendLog(jobId, 'pipeline.log', `[${stageName}] FAILED: ${err.message}`);
    await writeErrorSummary(jobId, stageName, err);
    return;
  }

  // Stage 2: Detect framework
  try {
    job = await markStageRunning(jobId, 'detect');
    job.status = 'detecting';
    await writeJob(jobId, job);
    const workspaceInfo = await detectFramework(jobId, workspacePath, job.input.rootPath);
    job = await readJob(jobId);
    job.workspace = workspaceInfo;
    await writeJob(jobId, job);
    await markStageSuccess(jobId, 'detect');
  } catch (err: any) {
    await markStageFailed(jobId, 'detect', err.message);
    await appendLog(jobId, 'pipeline.log', `[detect] FAILED: ${err.message}`);
    await writeErrorSummary(jobId, 'detect', err);
    return;
  }

  // Stage 3: Install dependencies
  try {
    job = await markStageRunning(jobId, 'install');
    job.status = 'installing';
    await writeJob(jobId, job);
    await installDeps(jobId, workspacePath, job.workspace!);
    await markStageSuccess(jobId, 'install');
  } catch (err: any) {
    await markStageFailed(jobId, 'install', err.message);
    await appendLog(jobId, 'pipeline.log', `[install] FAILED: ${err.message}`);
    await writeErrorSummary(jobId, 'install', err);
    // Continue - we might still be able to do static analysis
  }

  // Stage 4: Build
  let buildSuccess = false;
  try {
    job = await markStageRunning(jobId, 'build');
    job.status = 'building';
    await writeJob(jobId, job);
    await buildProject(jobId, workspacePath, job.workspace!);
    await markStageSuccess(jobId, 'build');
    buildSuccess = true;
  } catch (err: any) {
    await markStageFailed(jobId, 'build', err.message);
    await appendLog(jobId, 'pipeline.log', `[build] FAILED: ${err.message}`);
    // Continue - attempt static file serving
  }

  // Stage 5: Discover routes
  let routes: string[] = [];
  try {
    job = await markStageRunning(jobId, 'discover');
    job = await readJob(jobId);
    routes = await discoverRoutes(jobId, workspacePath, job.workspace!, job.input.routeHints);
    job = await readJob(jobId);
    job.routes = routes;
    await writeJob(jobId, job);
    await markStageSuccess(jobId, 'discover');
  } catch (err: any) {
    await markStageFailed(jobId, 'discover', err.message);
    routes = ['/'];
  }

  // Stage 6: Render
  let renderedRoutes: any[] = [];
  try {
    job = await markStageRunning(jobId, 'render');
    job.status = 'rendering';
    await writeJob(jobId, job);
    renderedRoutes = await renderRoutes(jobId, workspacePath, routes, job.workspace!);
    await markStageSuccess(jobId, 'render');
  } catch (err: any) {
    await markStageFailed(jobId, 'render', err.message);
    await appendLog(jobId, 'pipeline.log', `[render] FAILED: ${err.message}`);
  }

  // Stage 7: Analyze DOM
  let analyses: any[] = [];
  try {
    job = await markStageRunning(jobId, 'analyze');
    job.status = 'analyzing';
    await writeJob(jobId, job);
    analyses = await analyzeDOM(jobId, renderedRoutes);
    await markStageSuccess(jobId, 'analyze');
  } catch (err: any) {
    await markStageFailed(jobId, 'analyze', err.message);
    await appendLog(jobId, 'pipeline.log', `[analyze] FAILED: ${err.message}`);
  }

  // Stage 8: Generate wireframes
  try {
    job = await markStageRunning(jobId, 'generate');
    job.status = 'generating';
    await writeJob(jobId, job);
    job = await readJob(jobId);
    await generateWireframes(jobId, analyses, job.input.mode);
    await markStageSuccess(jobId, 'generate');
  } catch (err: any) {
    await markStageFailed(jobId, 'generate', err.message);
    await appendLog(jobId, 'pipeline.log', `[generate] FAILED: ${err.message}`);
  }

  // Stage 9: Export
  try {
    job = await markStageRunning(jobId, 'export');
    await writeJob(jobId, job);
    const artifacts = await exportArtifacts(jobId);
    job = await readJob(jobId);
    job.artifacts = artifacts;
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    await writeJob(jobId, job);
    await markStageSuccess(jobId, 'export');
  } catch (err: any) {
    await markStageFailed(jobId, 'export', err.message);
    await appendLog(jobId, 'pipeline.log', `[export] FAILED: ${err.message}`);
  }

  // Final status check
  job = await readJob(jobId);
  if (job.status !== 'completed') {
    const hasAnySuccess = job.stages.some(s => s.status === 'success');
    if (!hasAnySuccess) {
      job.status = 'failed';
    }
    job.updatedAt = new Date().toISOString();
    await writeJob(jobId, job);
  }
}

async function writeErrorSummary(jobId: string, stage: string, error: any): Promise<void> {
  const summary = {
    jobId,
    stage,
    error: error.message || String(error),
    stack: error.stack,
    timestamp: new Date().toISOString(),
    remediation: getRemediation(stage, error.message),
  };
  await writeArtifactFile(jobId, 'error-summary.json', JSON.stringify(summary, null, 2));
}

function getRemediation(stage: string, error: string): string {
  const remediations: Record<string, string> = {
    clone: 'Check that the repository URL is correct and publicly accessible. For private repos, authentication is required.',
    extract: 'Ensure the ZIP file is valid and not corrupted. The archive should contain a web project.',
    detect: 'The project structure could not be recognized. Ensure package.json or index.html exists at the root or specified path.',
    install: 'Dependency installation failed. Check that the package.json is valid and dependencies are available.',
    build: 'The build process failed. Check build logs for missing configurations or syntax errors.',
    discover: 'Route discovery failed. Try providing route hints manually.',
    render: 'Page rendering failed. The application may not start correctly or may require environment variables.',
    analyze: 'DOM analysis failed. The rendered pages may be empty or require JavaScript execution.',
    generate: 'Wireframe generation failed. This is likely an internal error.',
    export: 'Export failed. Check disk space and file permissions.',
  };
  return remediations[stage] || 'An unexpected error occurred. Check the logs for details.';
}
