import { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve project root: walk up from packages/backend/src/routes/ to repo root
function getProjectRoot(): string {
  if (process.env.REPOFRAME_PROJECT_ROOT) {
    return path.resolve(process.env.REPOFRAME_PROJECT_ROOT);
  }
  // Walk up from this file to find the repo root (has pnpm-workspace.yaml)
  let dir = path.resolve(__dirname, '..', '..', '..', '..');
  return dir;
}

const CREDENTIALS_PATH = path.join(getProjectRoot(), '.repoframe/credentials.json');

interface Credentials {
  figma?: {
    personalAccessToken: string;
    teamId?: string;
    projectId?: string;
  };
}

async function loadCredentials(): Promise<Credentials> {
  try {
    const raw = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCredentials(creds: Credentials): Promise<void> {
  await fs.mkdir(path.dirname(CREDENTIALS_PATH), { recursive: true });
  await fs.writeFile(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export const figmaRoutes: FastifyPluginAsync = async (app) => {
  // Get current Figma auth status (never exposes the full token)
  app.get('/status', async () => {
    const creds = await loadCredentials();
    const hasToken = !!creds.figma?.personalAccessToken;
    return {
      authenticated: hasToken,
      tokenPreview: hasToken
        ? `${creds.figma!.personalAccessToken.slice(0, 6)}...${creds.figma!.personalAccessToken.slice(-4)}`
        : null,
      teamId: creds.figma?.teamId || null,
      projectId: creds.figma?.projectId || null,
    };
  });

  // Store Figma credentials
  app.post<{
    Body: { personalAccessToken: string; teamId?: string; projectId?: string };
  }>('/login', async (request, reply) => {
    const { personalAccessToken, teamId, projectId } = request.body;

    if (!personalAccessToken || personalAccessToken.length < 10) {
      return reply.status(400).send({ error: 'Invalid personal access token' });
    }

    // Verify token with Figma API
    try {
      const res = await fetch('https://api.figma.com/v1/me', {
        headers: { 'X-Figma-Token': personalAccessToken },
      });

      if (!res.ok) {
        return reply.status(401).send({ error: 'Invalid Figma token - API rejected it' });
      }

      const user = await res.json() as { handle: string; email: string; id: string };

      const creds = await loadCredentials();
      creds.figma = {
        personalAccessToken,
        ...(teamId && { teamId }),
        ...(projectId && { projectId }),
      };
      await saveCredentials(creds);

      return reply.status(200).send({
        success: true,
        user: { handle: user.handle, email: user.email, id: user.id },
        storedAt: CREDENTIALS_PATH,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: `Failed to verify token: ${err.message}` });
    }
  });

  // Remove Figma credentials
  app.delete('/logout', async (_, reply) => {
    const creds = await loadCredentials();
    delete creds.figma;
    await saveCredentials(creds);
    return reply.status(200).send({ success: true });
  });

  // Proxy: verify current token
  app.get('/me', async (_, reply) => {
    const creds = await loadCredentials();
    const token = creds.figma?.personalAccessToken;
    if (!token) {
      return reply.status(401).send({ error: 'Not authenticated with Figma' });
    }

    const res = await fetch('https://api.figma.com/v1/me', {
      headers: { 'X-Figma-Token': token },
    });

    if (!res.ok) {
      return reply.status(res.status).send({ error: 'Figma API error' });
    }

    return res.json();
  });

  // List files in the project
  app.get('/files', async (_, reply) => {
    const creds = await loadCredentials();
    const token = creds.figma?.personalAccessToken;
    const projectId = creds.figma?.projectId;
    if (!token) {
      return reply.status(401).send({ error: 'Not authenticated with Figma' });
    }
    if (!projectId) {
      return reply.status(400).send({ error: 'No project ID configured. Update Figma settings.' });
    }

    const res = await fetch(`https://api.figma.com/v1/projects/${projectId}/files`, {
      headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) {
      const body = await res.text();
      return reply.status(res.status).send({ error: `Figma API: ${body}` });
    }
    const data = await res.json() as { files: Array<{ key: string; name: string; last_modified: string }> };
    return data.files || [];
  });

  // Sync wireframe to Figma (posts as comment with structured data)
  app.post<{
    Body: { jobId: string; fileKey?: string; route?: string; fidelity?: string };
  }>('/sync', async (request, reply) => {
    const { jobId, fileKey, route = '/', fidelity = 'lowfi' } = request.body;
    const creds = await loadCredentials();
    const token = creds.figma?.personalAccessToken;
    if (!token) {
      return reply.status(401).send({ error: 'Not authenticated with Figma' });
    }

    // Load the figma export artifact
    const artifactsDir = path.resolve(
      process.env.ARTIFACTS_DIR || path.join(getProjectRoot(), 'data/artifacts'),
      jobId
    );

    const sanitizedRoute = route.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'index';
    const possibleFilenames = [
      `figma-export-${fidelity}-${sanitizedRoute}.json`,
      `figma-export-${fidelity}-_${sanitizedRoute}.json`,
      `figma-export-${sanitizedRoute}.json`,
    ];

    let payload: any = null;
    let usedFilename = '';
    for (const fname of possibleFilenames) {
      try {
        const content = await fs.readFile(path.join(artifactsDir, fname), 'utf-8');
        payload = JSON.parse(content);
        usedFilename = fname;
        break;
      } catch {}
    }

    // If no specific figma export, try to find any figma-export file
    if (!payload) {
      try {
        const files = await fs.readdir(artifactsDir);
        const figmaFile = files.find(f => f.startsWith('figma-export') && f.endsWith('.json'));
        if (figmaFile) {
          const content = await fs.readFile(path.join(artifactsDir, figmaFile), 'utf-8');
          payload = JSON.parse(content);
          usedFilename = figmaFile;
        }
      } catch {}
    }

    if (!payload) {
      return reply.status(404).send({
        error: `No Figma export found for job ${jobId}. Run the pipeline first to generate wireframes.`,
      });
    }

    // Determine target file
    let targetFileKey = fileKey;
    if (!targetFileKey) {
      // Get first file from project
      const projectId = creds.figma?.projectId;
      if (!projectId) {
        return reply.status(400).send({ error: 'No fileKey provided and no project configured.' });
      }
      const filesRes = await fetch(`https://api.figma.com/v1/projects/${projectId}/files`, {
        headers: { 'X-Figma-Token': token },
      });
      if (!filesRes.ok) {
        return reply.status(filesRes.status).send({ error: 'Failed to list Figma files' });
      }
      const filesData = await filesRes.json() as { files: Array<{ key: string; name: string }> };
      if (!filesData.files || filesData.files.length === 0) {
        return reply.status(404).send({ error: 'No files found in Figma project. Create a file in Figma first.' });
      }
      targetFileKey = filesData.files[0].key;
    }

    // Post wireframe data as a structured comment to the Figma file
    const commentBody = {
      message: `[RepoFrame Wireframe Export]\n` +
        `Job: ${jobId}\n` +
        `Route: ${route}\n` +
        `Fidelity: ${fidelity}\n` +
        `File: ${usedFilename}\n` +
        `Exported: ${new Date().toISOString()}\n\n` +
        `Wireframe structure (${payload.document?.children?.length || 0} top-level frames, ` +
        `${Object.keys(payload.components || {}).length} components):\n\n` +
        `\`\`\`json\n${JSON.stringify(payload, null, 2).slice(0, 4000)}\n\`\`\``,
    };

    const commentRes = await fetch(`https://api.figma.com/v1/files/${targetFileKey}/comments`, {
      method: 'POST',
      headers: {
        'X-Figma-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commentBody),
    });

    if (!commentRes.ok) {
      const errBody = await commentRes.text();
      return reply.status(commentRes.status).send({
        error: `Figma API rejected the sync: ${errBody}`,
      });
    }

    const comment = await commentRes.json() as { id: string; file_key: string };

    return reply.status(200).send({
      success: true,
      figmaFileKey: targetFileKey,
      figmaFileUrl: `https://www.figma.com/file/${targetFileKey}`,
      commentId: comment.id,
      artifactUsed: usedFilename,
      payload: {
        route: payload.route,
        components: Object.keys(payload.components || {}).length,
        frames: payload.document?.children?.length || 0,
      },
    });
  });
};
