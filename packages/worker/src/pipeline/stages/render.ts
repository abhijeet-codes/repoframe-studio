import { chromium, Browser, Page } from 'playwright';
import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { WorkspaceInfo, DOMNodeSnapshot } from '@repoframe/shared';
import { appendLog, writeArtifactFile } from '../context.js';
import net from 'node:net';

const RENDER_TIMEOUT = parseInt(process.env.RENDER_TIMEOUT_MS || '60000', 10);
const SERVER_START_TIMEOUT = parseInt(process.env.SERVER_START_TIMEOUT_MS || '60000', 10);
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

  // For static sites or built projects, use built-in Node HTTP file server
  if (workspace.framework === 'static' || !workspace.devCommand) {
    const serveDir = await resolveStaticDir(projectDir, workspace.outputDir);
    await appendLog(jobId, 'render.log', `Starting built-in static server for: ${serveDir}`);

    const server = await startStaticFileServer(serveDir, port);
    const fakeProc = Object.assign(Object.create(null), {
      killed: false,
      kill(_signal?: string) {
        (fakeProc as any).killed = true;
        server.close();
      },
    }) as unknown as ChildProcess;

    return { process: fakeProc, url: `http://localhost:${port}` };
  }

  // For dev-mode projects, start the dev server
  const pm = workspace.packageManager || 'npm';
  const cmd = pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : pm === 'bun' ? 'bun' : 'npm';
  let args: string[];

  // Build the command with port argument
  const isVite = workspace.framework?.includes('vite') ||
    workspace.devCommand === 'dev' && await hasViteConfig(projectDir);

  if (pm === 'yarn') {
    args = [workspace.devCommand!];
    if (isVite) args.push('--port', String(port));
  } else {
    args = ['run', workspace.devCommand!];
    // Pass port via -- separator for npm/pnpm so it reaches the underlying tool
    if (isVite) args.push('--', '--port', String(port));
  }

  await appendLog(jobId, 'render.log', `Starting dev server: ${cmd} ${args.join(' ')} (port ${port}, framework=${workspace.framework})`);

  const proc = spawn(cmd, args, {
    cwd: projectDir,
    stdio: 'pipe',
    env: {
      ...process.env,
      PORT: String(port),
      BROWSER: 'none',
    },
  });

  let serverOutput = '';
  proc.stdout?.on('data', (d) => {
    const chunk = d.toString();
    serverOutput += chunk;
    appendLog(jobId, 'render.log', chunk);
  });
  proc.stderr?.on('data', (d) => {
    const chunk = d.toString();
    serverOutput += chunk;
    appendLog(jobId, 'render.log', chunk);
  });

  // Wait for server and detect actual URL from stdout
  const detectedUrl = await waitForDevServer(port, SERVER_START_TIMEOUT, () => serverOutput, proc);
  const url = detectedUrl || `http://localhost:${port}`;
  await appendLog(jobId, 'render.log', `Server ready at: ${url}`);
  return { process: proc, url };
}

async function extractDOMSnapshot(page: Page): Promise<DOMNodeSnapshot> {
  // Use page.evaluate with a string expression to avoid esbuild/tsx __name transform
  // that injects undefined helpers into the browser context
  return page.evaluate(`
    (function() {
      var traverse = function(el) {
        var rect = el.getBoundingClientRect();
        var style = window.getComputedStyle(el);

        if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) {
          return null;
        }

        var children = [];
        for (var i = 0; i < el.children.length; i++) {
          var result = traverse(el.children[i]);
          if (result) children.push(result);
        }

        var textContent = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
          ? (el.childNodes[0].textContent || '').trim() || undefined
          : undefined;

        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
          className: el.className && typeof el.className === 'string' ? el.className.slice(0, 200) : undefined,
          id: el.id || undefined,
          textContent: textContent ? textContent.slice(0, 500) : undefined,
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
          children: children,
        };
      };

      return traverse(document.body);
    })()
  `);
}

function sanitizeRoute(route: string): string {
  return route.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'index';
}

async function resolveStaticDir(projectDir: string, outputDir?: string): Promise<string> {
  if (outputDir) {
    const dir = path.join(projectDir, outputDir);
    try {
      await fs.access(path.join(dir, 'index.html'));
      return dir;
    } catch {}
  }

  // Try common output dirs
  for (const dir of ['dist', 'build', 'public', 'out', '.']) {
    const candidate = dir === '.' ? projectDir : path.join(projectDir, dir);
    try {
      await fs.access(path.join(candidate, 'index.html'));
      return candidate;
    } catch {}
  }

  return projectDir;
}

function startStaticFileServer(rootDir: string, port: number): Promise<http.Server> {
  const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      let urlPath = decodeURIComponent(new URL(req.url || '/', `http://localhost`).pathname);
      // Prevent directory traversal
      const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
      let filePath = path.join(rootDir, safePath);

      try {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
      } catch {
        // SPA fallback: serve index.html for non-file routes
        filePath = path.join(rootDir, 'index.html');
      }

      try {
        const content = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, 'localhost', () => resolve(server));
    server.on('error', reject);
  });
}

async function hasViteConfig(projectDir: string): Promise<boolean> {
  for (const name of ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.mts']) {
    try {
      await fs.access(path.join(projectDir, name));
      return true;
    } catch {}
  }
  return false;
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

/**
 * Wait for a dev server to be ready. Returns the detected URL from stdout if found.
 * Falls back to probing the specified port.
 */
async function waitForDevServer(
  expectedPort: number,
  timeout = 60000,
  getOutput?: () => string,
  proc?: ChildProcess
): Promise<string | null> {
  const start = Date.now();

  // Pattern to extract actual URL from dev server output
  const urlPatterns = [
    /(?:Local|localhost|http):?\s*(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)\/?/i,
    /https?:\/\/localhost:\d+/i,
    /https?:\/\/127\.0\.0\.1:\d+/i,
  ];

  // Readiness patterns (server is up even if we haven't found URL)
  const readyPatterns = [
    /ready in/i,
    /listening on/i,
    /started server/i,
    /compiled successfully/i,
    /webpack compiled/i,
    /server running/i,
    /available on/i,
    /VITE\s+v[\d.]+\s+ready/i,
  ];

  while (Date.now() - start < timeout) {
    // Check if server process died
    if (proc && proc.exitCode !== null) {
      throw new Error(`Dev server process exited with code ${proc.exitCode}`);
    }

    if (getOutput) {
      const output = getOutput();

      // Try to extract URL from output
      for (const pattern of urlPatterns) {
        const match = output.match(pattern);
        if (match) {
          const url = match[1] || match[0];
          const detectedPort = parseInt(new URL(url).port, 10);
          // Wait a moment then verify the detected port is connectable
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            await httpProbe(detectedPort);
            return url.replace(/\/$/, '');
          } catch {
            // URL found in output but not responding yet, keep trying
          }
        }
      }

      // Check if readiness pattern matched (try probing expected port)
      if (readyPatterns.some(p => p.test(output))) {
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          await httpProbe(expectedPort);
          return null; // Use expected port
        } catch {
          // Try common ports in case server chose its own
          for (const fallbackPort of [5173, 5174, 3000, 3001, 4200, 8080]) {
            if (fallbackPort === expectedPort) continue;
            try {
              await tcpProbe(fallbackPort);
              await httpProbe(fallbackPort);
              return `http://localhost:${fallbackPort}`;
            } catch {}
          }
        }
      }
    }

    // Try TCP connection on expected port
    try {
      await tcpProbe(expectedPort);
      await httpProbe(expectedPort);
      return null;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Last resort: check if any common port is serving before failing
  if (getOutput) {
    const output = getOutput();
    for (const pattern of urlPatterns) {
      const match = output.match(pattern);
      if (match) {
        const url = match[1] || match[0];
        try {
          const detectedPort = parseInt(new URL(url).port, 10);
          await tcpProbe(detectedPort);
          return url.replace(/\/$/, '');
        } catch {}
      }
    }
  }

  throw new Error(`Server did not start within ${timeout}ms on port ${expectedPort}`);
}

function tcpProbe(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host: 'localhost' }, () => {
      socket.destroy();
      resolve();
    });
    socket.on('error', reject);
    socket.setTimeout(2000, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
  });
}

function httpProbe(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      res.resume();
      resolve();
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('http timeout'));
    });
  });
}
