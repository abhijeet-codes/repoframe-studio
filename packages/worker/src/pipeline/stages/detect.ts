import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceInfo } from '@repoframe/shared';
import { appendLog } from '../context.js';

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function detectFramework(
  jobId: string,
  workspacePath: string,
  rootPath?: string
): Promise<WorkspaceInfo> {
  const projectRoot = rootPath ? path.join(workspacePath, rootPath) : workspacePath;

  await appendLog(jobId, 'pipeline.log', `[detect] Scanning ${projectRoot}`);

  // Detect package manager
  const packageManager = await detectPackageManager(projectRoot);
  await appendLog(jobId, 'pipeline.log', `[detect] Package manager: ${packageManager}`);

  // Read package.json
  let pkg: PackageJson | null = null;
  try {
    const pkgContent = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
    pkg = JSON.parse(pkgContent);
  } catch {
    // No package.json - might be a static site
  }

  // Detect framework
  const framework = detectFrameworkFromDeps(pkg);
  await appendLog(jobId, 'pipeline.log', `[detect] Framework: ${framework}`);

  // Determine commands
  const { buildCommand, devCommand, outputDir } = inferCommands(pkg, framework);

  const info: WorkspaceInfo = {
    path: projectRoot,
    packageManager,
    framework,
    buildCommand,
    devCommand,
    outputDir,
    detectedRoutes: [],
  };

  // Check for index.html (static site fallback)
  try {
    await fs.access(path.join(projectRoot, 'index.html'));
    info.entryPoint = 'index.html';
  } catch {
    // no index.html
  }

  await appendLog(jobId, 'pipeline.log', `[detect] Detection complete: ${JSON.stringify(info)}`);
  return info;
}

async function detectPackageManager(dir: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown'> {
  try {
    await fs.access(path.join(dir, 'pnpm-lock.yaml'));
    return 'pnpm';
  } catch {}
  try {
    await fs.access(path.join(dir, 'yarn.lock'));
    return 'yarn';
  } catch {}
  try {
    await fs.access(path.join(dir, 'bun.lockb'));
    return 'bun';
  } catch {}
  try {
    await fs.access(path.join(dir, 'package-lock.json'));
    return 'npm';
  } catch {}
  try {
    await fs.access(path.join(dir, 'package.json'));
    return 'npm';
  } catch {}
  return 'unknown';
}

function detectFrameworkFromDeps(pkg: PackageJson | null): string {
  if (!pkg) return 'static';

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (allDeps['next']) return 'nextjs';
  if (allDeps['nuxt'] || allDeps['nuxt3']) return 'nuxt';
  if (allDeps['@sveltejs/kit']) return 'sveltekit';
  if (allDeps['astro']) return 'astro';
  if (allDeps['gatsby']) return 'gatsby';
  if (allDeps['@remix-run/react']) return 'remix';
  if (allDeps['vite']) {
    if (allDeps['react']) return 'react-vite';
    if (allDeps['vue']) return 'vue-vite';
    if (allDeps['svelte']) return 'svelte-vite';
    return 'vite';
  }
  if (allDeps['react-scripts']) return 'create-react-app';
  if (allDeps['react']) return 'react';
  if (allDeps['vue']) return 'vue';
  if (allDeps['svelte']) return 'svelte';
  if (allDeps['@angular/core']) return 'angular';
  if (allDeps['express'] || allDeps['fastify'] || allDeps['koa']) return 'node-server';

  return 'unknown';
}

function inferCommands(pkg: PackageJson | null, framework: string) {
  let buildCommand: string | undefined;
  let devCommand: string | undefined;
  let outputDir: string | undefined;

  if (pkg?.scripts) {
    if (pkg.scripts.build) buildCommand = 'build';
    if (pkg.scripts.dev) devCommand = 'dev';
    else if (pkg.scripts.start) devCommand = 'start';
  }

  switch (framework) {
    case 'nextjs':
      outputDir = '.next';
      break;
    case 'react-vite':
    case 'vue-vite':
    case 'vite':
      outputDir = 'dist';
      break;
    case 'create-react-app':
      outputDir = 'build';
      break;
    case 'angular':
      outputDir = 'dist';
      break;
    case 'gatsby':
      outputDir = 'public';
      break;
    case 'astro':
      outputDir = 'dist';
      break;
  }

  return { buildCommand, devCommand, outputDir };
}
