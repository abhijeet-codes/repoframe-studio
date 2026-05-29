import { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';

const CREDENTIALS_PATH = path.resolve(
  process.env.REPOFRAME_PROJECT_ROOT || process.cwd(),
  '.repoframe/credentials.json'
);

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
};
