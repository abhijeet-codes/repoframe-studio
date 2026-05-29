import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const JOBS_DIR = path.resolve('./data/jobs');
const ARTIFACTS_DIR = path.resolve('./data/artifacts');

async function seed() {
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });

  // Demo job 1: Completed GitHub job
  const job1Id = randomUUID();
  const job1 = {
    id: job1Id,
    input: {
      source: 'github',
      githubUrl: 'https://github.com/vitejs/vite',
      branch: 'main',
      mode: 'both',
    },
    status: 'completed',
    stages: [
      { name: 'clone', status: 'success', startedAt: '2024-01-15T10:00:00Z', completedAt: '2024-01-15T10:00:05Z', durationMs: 5000, warnings: [] },
      { name: 'detect', status: 'success', startedAt: '2024-01-15T10:00:05Z', completedAt: '2024-01-15T10:00:06Z', durationMs: 1000, warnings: [] },
      { name: 'install', status: 'success', startedAt: '2024-01-15T10:00:06Z', completedAt: '2024-01-15T10:00:30Z', durationMs: 24000, warnings: [] },
      { name: 'build', status: 'success', startedAt: '2024-01-15T10:00:30Z', completedAt: '2024-01-15T10:01:00Z', durationMs: 30000, warnings: [] },
      { name: 'discover', status: 'success', startedAt: '2024-01-15T10:01:00Z', completedAt: '2024-01-15T10:01:01Z', durationMs: 1000, warnings: [] },
      { name: 'render', status: 'success', startedAt: '2024-01-15T10:01:01Z', completedAt: '2024-01-15T10:01:15Z', durationMs: 14000, warnings: [] },
      { name: 'analyze', status: 'success', startedAt: '2024-01-15T10:01:15Z', completedAt: '2024-01-15T10:01:17Z', durationMs: 2000, warnings: [] },
      { name: 'generate', status: 'success', startedAt: '2024-01-15T10:01:17Z', completedAt: '2024-01-15T10:01:20Z', durationMs: 3000, warnings: [] },
      { name: 'export', status: 'success', startedAt: '2024-01-15T10:01:20Z', completedAt: '2024-01-15T10:01:21Z', durationMs: 1000, warnings: [] },
    ],
    workspace: {
      path: '/data/workspaces/' + job1Id,
      packageManager: 'pnpm',
      framework: 'react-vite',
      buildCommand: 'build',
      devCommand: 'dev',
      outputDir: 'dist',
      detectedRoutes: ['/', '/guide', '/config'],
    },
    routes: ['/', '/guide', '/config'],
    artifacts: ['wireframe-lowfi-_index.json', 'lowfi-_index.svg', 'wireframe-highfi-_index.json', 'highfi-_index.svg', 'figma-export-lowfi-_index.json'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:01:21Z',
    completedAt: '2024-01-15T10:01:21Z',
  };

  // Demo job 2: Failed build job
  const job2Id = randomUUID();
  const job2 = {
    id: job2Id,
    input: {
      source: 'github',
      githubUrl: 'https://github.com/example/broken-app',
      mode: 'low-fi',
    },
    status: 'failed',
    stages: [
      { name: 'clone', status: 'success', startedAt: '2024-01-16T14:00:00Z', completedAt: '2024-01-16T14:00:03Z', durationMs: 3000, warnings: [] },
      { name: 'detect', status: 'success', startedAt: '2024-01-16T14:00:03Z', completedAt: '2024-01-16T14:00:04Z', durationMs: 1000, warnings: [] },
      { name: 'install', status: 'warning', startedAt: '2024-01-16T14:00:04Z', completedAt: '2024-01-16T14:00:40Z', durationMs: 36000, warnings: ['3 peer dependency warnings'] },
      { name: 'build', status: 'failed', startedAt: '2024-01-16T14:00:40Z', completedAt: '2024-01-16T14:01:10Z', durationMs: 30000, error: 'Build failed: Module not found: react-missing-dep', warnings: [] },
      { name: 'discover', status: 'skipped', warnings: [] },
      { name: 'render', status: 'skipped', warnings: [] },
      { name: 'analyze', status: 'skipped', warnings: [] },
      { name: 'generate', status: 'skipped', warnings: [] },
      { name: 'export', status: 'skipped', warnings: [] },
    ],
    workspace: {
      path: '/data/workspaces/' + job2Id,
      packageManager: 'npm',
      framework: 'create-react-app',
      buildCommand: 'build',
      devCommand: 'start',
      outputDir: 'build',
      detectedRoutes: [],
    },
    routes: [],
    artifacts: ['install.log', 'build.log', 'error-summary.json'],
    errorSummary: 'Build failed: Module not found: react-missing-dep',
    createdAt: '2024-01-16T14:00:00Z',
    updatedAt: '2024-01-16T14:01:10Z',
  };

  // Demo job 3: ZIP upload in progress
  const job3Id = randomUUID();
  const job3 = {
    id: job3Id,
    input: {
      source: 'zip',
      zipFileName: 'portfolio-site.zip',
      mode: 'both',
    },
    status: 'completed',
    stages: [
      { name: 'extract', status: 'success', startedAt: '2024-01-17T09:00:00Z', completedAt: '2024-01-17T09:00:02Z', durationMs: 2000, warnings: [] },
      { name: 'detect', status: 'success', startedAt: '2024-01-17T09:00:02Z', completedAt: '2024-01-17T09:00:03Z', durationMs: 1000, warnings: [] },
      { name: 'install', status: 'success', startedAt: '2024-01-17T09:00:03Z', completedAt: '2024-01-17T09:00:15Z', durationMs: 12000, warnings: [] },
      { name: 'build', status: 'success', startedAt: '2024-01-17T09:00:15Z', completedAt: '2024-01-17T09:00:25Z', durationMs: 10000, warnings: [] },
      { name: 'discover', status: 'success', startedAt: '2024-01-17T09:00:25Z', completedAt: '2024-01-17T09:00:26Z', durationMs: 1000, warnings: [] },
      { name: 'render', status: 'success', startedAt: '2024-01-17T09:00:26Z', completedAt: '2024-01-17T09:00:35Z', durationMs: 9000, warnings: [] },
      { name: 'analyze', status: 'success', startedAt: '2024-01-17T09:00:35Z', completedAt: '2024-01-17T09:00:36Z', durationMs: 1000, warnings: [] },
      { name: 'generate', status: 'success', startedAt: '2024-01-17T09:00:36Z', completedAt: '2024-01-17T09:00:38Z', durationMs: 2000, warnings: [] },
      { name: 'export', status: 'success', startedAt: '2024-01-17T09:00:38Z', completedAt: '2024-01-17T09:00:39Z', durationMs: 1000, warnings: [] },
    ],
    workspace: {
      path: '/data/workspaces/' + job3Id,
      packageManager: 'npm',
      framework: 'static',
      entryPoint: 'index.html',
      detectedRoutes: ['/', '/about.html', '/contact.html'],
    },
    routes: ['/', '/about.html', '/contact.html'],
    artifacts: ['wireframe-lowfi-_index.json', 'lowfi-_index.svg', 'highfi-_index.svg', 'screenshot-_index.png', 'figma-export-lowfi-_index.json'],
    createdAt: '2024-01-17T09:00:00Z',
    updatedAt: '2024-01-17T09:00:39Z',
    completedAt: '2024-01-17T09:00:39Z',
  };

  await fs.writeFile(path.join(JOBS_DIR, `${job1Id}.json`), JSON.stringify(job1, null, 2));
  await fs.writeFile(path.join(JOBS_DIR, `${job2Id}.json`), JSON.stringify(job2, null, 2));
  await fs.writeFile(path.join(JOBS_DIR, `${job3Id}.json`), JSON.stringify(job3, null, 2));

  // Create sample artifact directories
  const art1Dir = path.join(ARTIFACTS_DIR, job1Id);
  const art2Dir = path.join(ARTIFACTS_DIR, job2Id);
  await fs.mkdir(art1Dir, { recursive: true });
  await fs.mkdir(art2Dir, { recursive: true });

  // Sample wireframe SVG
  const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900">
<rect width="1440" height="900" fill="#F9FAFB"/>
<rect x="0" y="0" width="1440" height="64" fill="#F3F4F6" stroke="#D1D5DB" stroke-width="1"/>
<text x="24" y="40" fill="#374151" font-size="20" font-weight="bold" font-family="system-ui">RepoFrame</text>
<rect x="1200" y="16" width="100" height="32" fill="#9CA3AF" rx="6"/>
<text x="1250" y="36" text-anchor="middle" fill="#FFFFFF" font-size="14" font-family="system-ui">Sign In</text>
<rect x="100" y="120" width="600" height="400" fill="#FAFAFA" stroke="#D1D5DB" stroke-width="1" rx="8"/>
<text x="120" y="160" fill="#374151" font-size="32" font-weight="bold" font-family="system-ui">Welcome to the App</text>
<text x="120" y="200" fill="#374151" font-size="14" font-family="system-ui">————————————————</text>
<rect x="120" y="240" width="200" height="44" fill="#9CA3AF" rx="6"/>
<text x="220" y="266" text-anchor="middle" fill="#FFFFFF" font-size="14" font-family="system-ui">Get Started</text>
<rect x="800" y="120" width="540" height="400" fill="#E5E7EB" stroke="#D1D5DB" stroke-width="1" rx="8"/>
<rect x="0" y="850" width="1440" height="50" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1"/>
</svg>`;

  await fs.writeFile(path.join(art1Dir, 'lowfi-_index.svg'), sampleSvg);
  await fs.writeFile(path.join(art1Dir, 'highfi-_index.svg'), sampleSvg.replace('#9CA3AF', '#3B82F6').replace('#F9FAFB', '#FFFFFF'));

  // Sample wireframe JSON
  const sampleWireframe = {
    id: randomUUID(),
    jobId: job1Id,
    route: '/',
    mode: 'low-fi',
    viewport: { width: 1440, height: 900 },
    root: {
      id: randomUUID(),
      type: 'frame',
      name: 'Root',
      bounds: { x: 0, y: 0, width: 1440, height: 900 },
      zIndex: 0,
      opacity: 1,
      children: [
        {
          id: randomUUID(),
          type: 'header',
          name: 'Header',
          bounds: { x: 0, y: 0, width: 1440, height: 64 },
          zIndex: 0,
          opacity: 1,
          backgroundColor: '#F3F4F6',
          children: [],
        },
        {
          id: randomUUID(),
          type: 'section',
          name: 'Hero',
          bounds: { x: 100, y: 120, width: 600, height: 400 },
          zIndex: 0,
          opacity: 1,
          children: [
            {
              id: randomUUID(),
              type: 'heading',
              name: 'Welcome to the App',
              bounds: { x: 120, y: 140, width: 400, height: 40 },
              zIndex: 0,
              opacity: 1,
              textContent: 'Welcome to the App',
              textStyle: { fontSize: 32, fontWeight: 'bold' },
              children: [],
            },
            {
              id: randomUUID(),
              type: 'button',
              name: 'Get Started',
              bounds: { x: 120, y: 240, width: 200, height: 44 },
              zIndex: 0,
              opacity: 1,
              textContent: 'Get Started',
              borderRadius: 6,
              children: [],
            },
          ],
        },
      ],
    },
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(art1Dir, 'wireframe-lowfi-_index.json'), JSON.stringify(sampleWireframe, null, 2));

  // Sample Figma export
  const sampleFigma = {
    version: '1.0',
    jobId: job1Id,
    route: '/',
    document: {
      name: 'RepoFrame - /',
      children: [{
        type: 'FRAME',
        name: 'Root',
        x: 0, y: 0, width: 1440, height: 900,
        layoutMode: 'VERTICAL',
        children: [
          { type: 'FRAME', name: 'Header', x: 0, y: 0, width: 1440, height: 64, fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.96, b: 0.97, a: 1 } }] },
          { type: 'FRAME', name: 'Hero', x: 100, y: 120, width: 600, height: 400, layoutMode: 'VERTICAL', itemSpacing: 16 },
        ],
      }],
    },
    components: {
      'button-Get Started': { type: 'COMPONENT', name: 'Get Started', x: 120, y: 240, width: 200, height: 44, cornerRadius: 6, fills: [{ type: 'SOLID', color: { r: 0.23, g: 0.51, b: 0.96, a: 1 } }] },
    },
    exportedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(art1Dir, 'figma-export-lowfi-_index.json'), JSON.stringify(sampleFigma, null, 2));

  // Sample error summary for failed job
  const errorSummary = {
    jobId: job2Id,
    stage: 'build',
    error: 'Build failed: Module not found: react-missing-dep',
    timestamp: '2024-01-16T14:01:10Z',
    remediation: 'The build process failed. Check build logs for missing configurations or syntax errors.',
  };
  await fs.writeFile(path.join(art2Dir, 'error-summary.json'), JSON.stringify(errorSummary, null, 2));
  await fs.writeFile(path.join(art2Dir, 'build.log'), 'Error: Cannot find module \'react-missing-dep\'\n  at Module._resolveFilename (node:internal/modules/cjs/loader:1075:15)\n  ...\n\nBuild failed with 1 error.');
  await fs.writeFile(path.join(art2Dir, 'install.log'), 'npm warn deprecated @types/react@17.0.0: Use @types/react@18\nnpm warn peer dep: react-missing-dep requires react@^16.0.0\n\nadded 1247 packages in 34s');

  console.log('Seed data created successfully!');
  console.log(`  Job 1 (completed): ${job1Id}`);
  console.log(`  Job 2 (failed):    ${job2Id}`);
  console.log(`  Job 3 (completed): ${job3Id}`);
}

seed().catch(console.error);
