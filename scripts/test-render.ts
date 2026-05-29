/**
 * End-to-end test: runs the render stage on the tourism1 repo.
 * Usage: cd packages/worker && pnpm exec tsx ../../scripts/test-render.ts
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
  const { renderRoutes } = await import('../packages/worker/src/pipeline/stages/render.js');

  // Create job artifacts dir
  const artifactsDir = path.join(ROOT, 'data/artifacts', JOB_ID);
  await fs.mkdir(artifactsDir, { recursive: true });

  console.log('Testing render stage on tourism1 repo...');
  console.log(`Workspace: ${WORKSPACE_PATH}`);
  console.log('');

  const startTime = Date.now();

  try {
    const results = await renderRoutes(JOB_ID, WORKSPACE_PATH, ['/'], {
      path: WORKSPACE_PATH,
      packageManager: 'npm',
      framework: 'react-vite',
      devCommand: 'dev',
      buildCommand: 'build',
      outputDir: 'dist',
      detectedRoutes: ['/'],
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nRender completed in ${elapsed}s`);
    console.log('Results:');
    for (const r of results) {
      if (r.error) {
        console.log(`  ❌ ${r.route}: ${r.error}`);
      } else {
        console.log(`  ✅ ${r.route}: screenshot=${r.screenshotPath}, DOM nodes captured`);
      }
    }

    // Check artifacts
    const files = await fs.readdir(artifactsDir);
    console.log(`\nArtifacts (${files.length}):`);
    for (const f of files) {
      const stat = await fs.stat(path.join(artifactsDir, f));
      console.log(`  ${f} (${(stat.size / 1024).toFixed(1)}KB)`);
    }

    process.exit(0);
  } catch (err: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ Render FAILED after ${elapsed}s: ${err.message}`);

    // Print render log if available
    try {
      const log = await fs.readFile(path.join(artifactsDir, 'render.log'), 'utf-8');
      console.error('\n--- render.log ---');
      console.error(log.slice(-2000));
    } catch {}

    process.exit(1);
  }
}

main();
