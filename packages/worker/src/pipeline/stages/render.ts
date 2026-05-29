import { chromium, Browser, Page } from 'playwright';
import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceInfo, DOMNodeSnapshot } from '@repoframe/shared';
import { appendLog, writeArtifactFile } from '../context.js';
import net from 'node:net';

const RENDER_TIMEOUT = parseInt(process.env.RENDER_TIMEOUT_MS || '60000', 10);
const VIEWPORT_WIDTH = parseInt(process.env.VIEWPORT_WIDTH || '1440', 10);
const VIEWPORT_HEIGHT = parseInt(process.env.VIEWPORT_HEIGHT || '900', 10);

interface RenderedRoute {
  route: string;
  url: string;
  screenshotPath?: string;
  domSnapshot?: DOMNodeSnapshot;
  error?: string;
}

export async function renderRoutes(
  jobId: string,
  workspacePath: string,
  routes: string[],
  workspace: WorkspaceInfo
): Promise<RenderedRoute[]> {
  const results: RenderedRoute[] = [];
  let serverProcess: ChildProcess | null = null;
  let browser: Browser | null = null;
  let baseUrl: string;

  try {
    // Determine how to serve the content
    const serveResult = await startServer(jobId, workspace);
    serverProcess = serveResult.process;
    baseUrl = serveResult.url;

    await appendLog(jobId, 'render.log', `Server running at ${baseUrl}`);
    await appendLog(jobId, 'pipeline.log', `[render] Server at ${baseUrl}, rendering ${routes.length} routes`);

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const route of routes) {
      const url = new URL(route, baseUrl).toString();
      await appendLog(jobId, 'render.log', `Rendering ${url}`);

      try {
        const page = await browser.newPage();
        await page.setViewportSize({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
        await page.goto(url, { waitUntil: 'networkidle', timeout: RENDER_TIMEOUT });

        // Wait for content to stabilize
        await page.waitForTimeout(1000);

        // Take screenshot
        const screenshotFilename = `screenshot-${sanitizeRoute(route)}.png`;
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        const screenshotPath = await writeArtifactFile(jobId, screenshotFilename, screenshotBuffer);

        // Extract DOM snapshot
        const domSnapshot = await extractDOMSnapshot(page);

        results.push({
          route,
          url,
          screenshotPath: screenshotFilename,
          domSnapshot,
        });

        await page.close();
      } catch (err: any) {
        await appendLog(jobId, 'render.log', `Error rendering ${route}: ${err.message}`);
        results.push({
          route,
          url,
          error: err.message,
        });
      }
    }
  } finally {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!serverProcess.killed) serverProcess.kill('SIGKILL');
    }
  }

  await appendLog(jobId, 'pipeline.log', `[render] Rendered ${results.filter(r => !r.error).length}/${routes.length} routes`);
  return results;
}

async function startServer(jobId: string, workspace: WorkspaceInfo): Promise<{ process: ChildProcess | null; url: string }> {
  const projectDir = workspace.path;
  const port = await findFreePort();

  // For static sites or built projects, use a simple file server
  if (workspace.framework === 'static' || !workspace.devCommand) {
    const serveDir = workspace.outputDir
      ? path.join(projectDir, workspace.outputDir)
      : projectDir;

    // Check if serve dir exists with an index.html
    try {
      await fs.access(path.join(serveDir, 'index.html'));
    } catch {
      // Try common output dirs
      for (const dir of ['dist', 'build', 'public', 'out', '.']) {
        try {
          await fs.access(path.join(projectDir, dir, 'index.html'));
          const actualServeDir = path.join(projectDir, dir);
          const proc = spawn('npx', ['serve', '-s', actualServeDir, '-l', String(port)], {
            cwd: projectDir,
            stdio: 'pipe',
            env: { ...process.env, PORT: String(port) },
          });
          await waitForServer(port);
          return { process: proc, url: `http://localhost:${port}` };
        } catch {}
      }
    }

    const proc = spawn('npx', ['serve', '-s', serveDir, '-l', String(port)], {
      cwd: projectDir,
      stdio: 'pipe',
      env: { ...process.env, PORT: String(port) },
    });

    proc.stdout?.on('data', (d) => appendLog(jobId, 'render.log', d.toString()));
    proc.stderr?.on('data', (d) => appendLog(jobId, 'render.log', d.toString()));

    await waitForServer(port);
    return { process: proc, url: `http://localhost:${port}` };
  }

  // For dev-mode projects, start the dev server
  const pm = workspace.packageManager || 'npm';
  const cmd = pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : pm === 'bun' ? 'bun' : 'npm';
  const args = pm === 'yarn' ? [workspace.devCommand!] : ['run', workspace.devCommand!];

  const proc = spawn(cmd, args, {
    cwd: projectDir,
    stdio: 'pipe',
    env: { ...process.env, PORT: String(port), BROWSER: 'none' },
  });

  proc.stdout?.on('data', (d) => appendLog(jobId, 'render.log', d.toString()));
  proc.stderr?.on('data', (d) => appendLog(jobId, 'render.log', d.toString()));

  await waitForServer(port, 30000);
  return { process: proc, url: `http://localhost:${port}` };
}

async function extractDOMSnapshot(page: Page): Promise<DOMNodeSnapshot> {
  return page.evaluate(() => {
    function traverse(el: Element): any {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) {
        return null;
      }

      const children: any[] = [];
      for (const child of el.children) {
        const result = traverse(child);
        if (result) children.push(result);
      }

      const textContent = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
        ? el.childNodes[0].textContent?.trim() || undefined
        : undefined;

      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        className: el.className && typeof el.className === 'string' ? el.className.slice(0, 200) : undefined,
        id: el.id || undefined,
        textContent: textContent?.slice(0, 500),
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        computedStyles: {
          display: style.display,
          position: style.position,
          flexDirection: style.flexDirection,
          justifyContent: style.justifyContent,
          alignItems: style.alignItems,
          gap: style.gap,
          backgroundColor: style.backgroundColor,
          color: style.color,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          borderRadius: style.borderRadius,
          padding: style.padding,
          margin: style.margin,
          border: style.border,
          overflow: style.overflow,
          zIndex: style.zIndex,
        },
        isVisible: true,
        children,
      };
    }

    return traverse(document.body);
  });
}

function sanitizeRoute(route: string): string {
  return route.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'index';
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        server.close(() => resolve(addr.port));
      } else {
        reject(new Error('Failed to find free port'));
      }
    });
    server.on('error', reject);
  });
}

async function waitForServer(port: number, timeout = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ port, host: 'localhost' }, () => {
          socket.destroy();
          resolve();
        });
        socket.on('error', reject);
        socket.setTimeout(1000, () => {
          socket.destroy();
          reject(new Error('timeout'));
        });
      });
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Server did not start within ${timeout}ms on port ${port}`);
}
