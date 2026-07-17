/**
 * Full pipeline test on tourism1: runs all stages including export.
 * Usage: cd packages/worker && pnpm exec tsx ../../scripts/test-full-pipeline.ts
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Setup environment
process.env.STORAGE_DIR = path.join(ROOT, 'data');
process.env.JOBS_DIR = path.join(ROOT, 'data/jobs');
process.env.WORKSPACES_DIR = path.join(ROOT, 'data/workspaces');
process.env.ARTIFACTS_DIR = path.join(ROOT, 'data/artifacts');
process.env.SERVER_START_TIMEOUT_MS = '60000';

const JOB_ID = 'test-render-tourism1';
const WORKSPACE_PATH = path.join(ROOT, 'data/test-workspace/tourism1');

async function main() {
  // Ensure dirs exist
  await fs.mkdir(path.join(ROOT, 'data/jobs'), { recursive: true });
  await fs.mkdir(path.join(ROOT, 'data/workspaces'), { recursive: true });
  await fs.mkdir(path.join(ROOT, 'data/artifacts', JOB_ID), { recursive: true });

  // Symlink workspace so the runner can find it
  const wsLink = path.join(ROOT, 'data/workspaces', JOB_ID);
  try { await fs.unlink(wsLink); } catch {}
  try { await fs.symlink(WORKSPACE_PATH, wsLink); } catch {}

  // Create job JSON
  const job = {
    id: JOB_ID,
    status: 'queued',
    input: {
      source: 'github',
      githubUrl: 'https://github.com/jolinajavier02/tourism1.git',
      mode: 'low-fi',
    },
    stages: [
      { name: 'clone', status: 'success', startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
      { name: 'detect', status: 'pending' },
      { name: 'install', status: 'pending' },
      { name: 'build', status: 'pending' },
      { name: 'discover', status: 'pending' },
      { name: 'render', status: 'pending' },
      { name: 'analyze', status: 'pending' },
      { name: 'generate', status: 'pending' },
      { name: 'export', status: 'pending' },
    ],
    routes: [],
    artifacts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(ROOT, 'data/jobs', `${JOB_ID}.json`),
    JSON.stringify(job, null, 2),
    'utf-8'
  );

  console.log('Running full pipeline on tourism1...');
  console.log(`Job ID: ${JOB_ID}`);
  console.log(`Workspace: ${WORKSPACE_PATH}`);
  console.log('');

  // Import pipeline stages individually to skip clone (already done)
  const { detectFramework } = await import('../packages/worker/src/pipeline/stages/detect.js');
  const { installDeps } = await import('../packages/worker/src/pipeline/stages/install.js');
  const { buildProject } = await import('../packages/worker/src/pipeline/stages/build.js');
  const { discoverRoutes } = await import('../packages/worker/src/pipeline/stages/discover.js');
  const { renderRoutes } = await import('../packages/worker/src/pipeline/stages/render.js');
  const { analyzeDOM } = await import('../packages/worker/src/pipeline/stages/analyze.js');
  const { generateWireframes } = await import('../packages/worker/src/pipeline/stages/generate.js');
  const { exportArtifacts } = await import('../packages/worker/src/pipeline/stages/export.js');

  const startTime = Date.now();

  // Stage: detect
  console.log('[detect] Starting...');
  const workspace = await detectFramework(JOB_ID, WORKSPACE_PATH);
  console.log(`[detect] Done: ${workspace.framework} (${workspace.packageManager})`);
  job.workspace = workspace as any;

  // Stage: install
  console.log('[install] Starting...');
  try {
    await installDeps(JOB_ID, WORKSPACE_PATH, workspace);
    console.log('[install] Done');
  } catch (e: any) {
    console.log(`[install] Skipped/failed: ${e.message}`);
  }

  // Stage: build  
  console.log('[build] Starting...');
  try {
    await buildProject(JOB_ID, WORKSPACE_PATH, workspace);
    console.log('[build] Done');
  } catch (e: any) {
    console.log(`[build] Skipped/failed: ${e.message}`);
  }

  // Stage: discover
  console.log('[discover] Starting...');
  let routes: string[] = [];
  try {
    routes = await discoverRoutes(JOB_ID, WORKSPACE_PATH, workspace);
    console.log(`[discover] Done: ${routes.length} routes: ${routes.join(', ')}`);
  } catch (e: any) {
    console.log(`[discover] Fallback to /: ${e.message}`);
    routes = ['/'];
  }

  // Stage: render
  console.log('[render] Starting...');
  let rendered: any[] = [];
  try {
    rendered = await renderRoutes(JOB_ID, WORKSPACE_PATH, routes, workspace);
    console.log(`[render] Done: ${rendered.length} pages rendered`);
    for (const r of rendered) {
      console.log(`  route=${r.route}, hasDOM=${!!r.domSnapshot}, err=${r.error || 'none'}`);
    }
  } catch (e: any) {
    console.log(`[render] Failed: ${e.message}`);
  }

  // Stage: analyze
  console.log('[analyze] Starting...');
  let analyses: any[] = [];
  try {
    analyses = await analyzeDOM(JOB_ID, rendered);
    console.log(`[analyze] Done: ${analyses.length} analyses`);
    for (const a of analyses) {
      console.log(`  route=${a.route}, hasTree=${!!a.wireframeTree}, children=${a.wireframeTree?.children?.length || 0}`);
    }
  } catch (e: any) {
    console.log(`[analyze] Failed: ${e.message}`);
  }

  // Stage: generate
  console.log('[generate] Starting...');
  try {
    await generateWireframes(JOB_ID, analyses, 'low-fi');
    console.log('[generate] Done');
  } catch (e: any) {
    console.log(`[generate] Failed: ${e.message}`);
  }

  // Stage: export
  console.log('[export] Starting...');
  try {
    const artifacts = await exportArtifacts(JOB_ID);
    console.log(`[export] Done: ${artifacts.length} artifacts`);
    job.artifacts = artifacts;
  } catch (e: any) {
    console.log(`[export] Failed: ${e.message}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nPipeline completed in ${elapsed}s`);

  // Update job
  job.status = 'completed';
  job.completedAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();
  job.routes = routes;
  await fs.writeFile(
    path.join(ROOT, 'data/jobs', `${JOB_ID}.json`),
    JSON.stringify(job, null, 2),
    'utf-8'
  );

  // List artifacts
  const artifactsDir = path.join(ROOT, 'data/artifacts', JOB_ID);
  const files = await fs.readdir(artifactsDir);
  console.log(`\nArtifacts dir (${files.length} files):`);
  for (const f of files) {
    const stat = await fs.stat(path.join(artifactsDir, f));
    console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
