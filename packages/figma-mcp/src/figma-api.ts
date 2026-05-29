import { getFigmaToken } from './credentials.js';
import { FigmaExportPayload, FigmaNode } from '@repoframe/shared';

const FIGMA_API_BASE = 'https://api.figma.com/v1';

export interface FigmaFile {
  key: string;
  name: string;
  lastModified: string;
}

export interface FigmaProject {
  id: string;
  name: string;
}

async function figmaFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getFigmaToken();
  if (!token) {
    throw new Error('Figma personal access token not configured. Run "repoframe_figma_login" tool first.');
  }

  const res = await fetch(`${FIGMA_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'X-Figma-Token': token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API error (${res.status}): ${body}`);
  }

  return res.json();
}

export async function getMe(): Promise<{ id: string; handle: string; email: string }> {
  return figmaFetch('/me');
}

export async function getTeamProjects(teamId: string): Promise<FigmaProject[]> {
  const data = await figmaFetch(`/teams/${teamId}/projects`);
  return data.projects;
}

export async function getProjectFiles(projectId: string): Promise<FigmaFile[]> {
  const data = await figmaFetch(`/projects/${projectId}/files`);
  return data.files;
}

export async function getFile(fileKey: string): Promise<any> {
  return figmaFetch(`/files/${fileKey}`);
}

export async function createFileInProject(
  projectId: string,
  name: string
): Promise<{ key: string; name: string }> {
  // Figma doesn't have a direct "create file" API endpoint via REST,
  // but we can use the file creation through the Plugin API or import.
  // For MCP, we'll use the file import approach via their API.
  throw new Error(
    'Direct file creation requires the Figma Plugin API. ' +
    'Use repoframe_figma_push_to_file to add wireframe content to an existing file.'
  );
}

export async function postComment(
  fileKey: string,
  message: string,
  position?: { x: number; y: number }
): Promise<any> {
  const body: any = { message };
  if (position) {
    body.client_meta = { x: position.x, y: position.y };
  }
  return figmaFetch(`/files/${fileKey}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getFileNodes(fileKey: string, nodeIds: string[]): Promise<any> {
  const ids = nodeIds.join(',');
  return figmaFetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`);
}

export async function getImages(fileKey: string, nodeIds: string[], format = 'png', scale = 2): Promise<Record<string, string>> {
  const ids = nodeIds.join(',');
  const data = await figmaFetch(`/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`);
  return data.images;
}

/**
 * Convert our FigmaExportPayload into Figma Plugin API commands
 * that can be executed by the companion Figma plugin.
 */
export function generatePluginCommands(payload: FigmaExportPayload): object[] {
  const commands: object[] = [];

  // Create page
  commands.push({
    action: 'createPage',
    name: payload.document.name,
  });

  // Create component definitions first
  if (payload.components) {
    for (const [key, component] of Object.entries(payload.components)) {
      commands.push({
        action: 'createComponent',
        key,
        node: component,
      });
    }
  }

  // Create frame tree
  for (const child of payload.document.children) {
    commands.push({
      action: 'createNode',
      node: child,
      parentId: 'page',
    });
  }

  return commands;
}
