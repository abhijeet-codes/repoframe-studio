import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceInfo } from '@repoframe/shared';
import { appendLog } from '../context.js';

export async function discoverRoutes(
  jobId: string,
  workspacePath: string,
  workspace: WorkspaceInfo,
  routeHints?: string[]
): Promise<string[]> {
  const routes: Set<string> = new Set();

  // Add user-provided route hints
  if (routeHints && routeHints.length > 0) {
    for (const hint of routeHints) {
      routes.add(hint.startsWith('/') ? hint : `/${hint}`);
    }
    await appendLog(jobId, 'pipeline.log', `[discover] Using ${routeHints.length} route hints`);
  }

  const projectDir = workspace.path;

  // Always include root
  routes.add('/');

  // Framework-specific route discovery
  switch (workspace.framework) {
    case 'nextjs':
      await discoverNextRoutes(projectDir, routes);
      break;
    case 'react-vite':
    case 'create-react-app':
    case 'react':
      await discoverReactRoutes(projectDir, routes);
      break;
    case 'static':
      await discoverStaticRoutes(projectDir, routes);
      break;
    default:
      await discoverStaticRoutes(projectDir, routes);
      break;
  }

  const result = Array.from(routes).slice(0, parseInt(process.env.MAX_ROUTES_PER_JOB || '50', 10));
  await appendLog(jobId, 'pipeline.log', `[discover] Found ${result.length} routes: ${result.join(', ')}`);
  return result;
}

async function discoverNextRoutes(projectDir: string, routes: Set<string>): Promise<void> {
  // Check app directory (App Router)
  const appDir = path.join(projectDir, 'app');
  try {
    await scanNextAppDir(appDir, '', routes);
  } catch {}

  // Check pages directory (Pages Router)
  const pagesDir = path.join(projectDir, 'pages');
  try {
    await scanNextPagesDir(pagesDir, routes);
  } catch {}

  // Also check src/app and src/pages
  try { await scanNextAppDir(path.join(projectDir, 'src', 'app'), '', routes); } catch {}
  try { await scanNextPagesDir(path.join(projectDir, 'src', 'pages'), routes); } catch {}
}

async function scanNextAppDir(dir: string, prefix: string, routes: Set<string>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      const segment = entry.name.startsWith('(') ? '' : `/${entry.name}`;
      // Check if this directory has a page file
      const subDir = path.join(dir, entry.name);
      try {
        const subEntries = await fs.readdir(subDir);
        if (subEntries.some(f => f.startsWith('page.'))) {
          routes.add(prefix + segment || '/');
        }
      } catch {}
      await scanNextAppDir(subDir, prefix + segment, routes);
    }
  }
}

async function scanNextPagesDir(dir: string, routes: Set<string>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      await scanNextPagesDir(path.join(dir, entry.name), routes);
    } else {
      const ext = path.extname(entry.name);
      if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
        const name = entry.name.replace(ext, '');
        if (name === 'index') {
          routes.add('/');
        } else if (!name.startsWith('[')) {
          routes.add(`/${name}`);
        }
      }
    }
  }
}

async function discoverReactRoutes(projectDir: string, routes: Set<string>): Promise<void> {
  // Scan source files for react-router route definitions
  const srcDir = path.join(projectDir, 'src');
  try {
    await scanForRoutePatterns(srcDir, routes);
  } catch {}
}

async function scanForRoutePatterns(dir: string, routes: Set<string>): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanForRoutePatterns(fullPath, routes);
      } else {
        const ext = path.extname(entry.name);
        if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            // Match react-router path props
            const pathMatches = content.matchAll(/path=["']([^"']+)["']/g);
            for (const match of pathMatches) {
              const route = match[1];
              if (route && !route.includes(':') && !route.includes('*')) {
                routes.add(route.startsWith('/') ? route : `/${route}`);
              }
            }
          } catch {}
        }
      }
    }
  } catch {}
}

async function discoverStaticRoutes(projectDir: string, routes: Set<string>): Promise<void> {
  // Find HTML files
  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.html')) {
        const name = entry.name === 'index.html' ? '/' : `/${entry.name}`;
        routes.add(name);
      }
    }
  } catch {}

  // Check common output directories
  for (const dir of ['dist', 'build', 'public', 'out']) {
    try {
      const outputDir = path.join(projectDir, dir);
      const entries = await fs.readdir(outputDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.html')) {
          const name = entry.name === 'index.html' ? '/' : `/${entry.name}`;
          routes.add(name);
        }
      }
    } catch {}
  }
}
