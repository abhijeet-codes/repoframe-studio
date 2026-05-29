#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadCredentials, saveCredentials, getFigmaToken, clearCredentials } from './credentials.js';
import { getMe, getTeamProjects, getProjectFiles, getFile, postComment, generatePluginCommands, getImages } from './figma-api.js';

const REPOFRAME_ROOT = process.env.REPOFRAME_PROJECT_ROOT || process.cwd();

const server = new Server(
  {
    name: 'repoframe-figma-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ─── Tools ────────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'repoframe_figma_login',
      description: 'Store Figma personal access token for API access. The token is saved locally in .repoframe/credentials.json in the project root.',
      inputSchema: {
        type: 'object',
        properties: {
          personalAccessToken: {
            type: 'string',
            description: 'Figma Personal Access Token (from Figma > Settings > Account > Personal access tokens)',
          },
          teamId: {
            type: 'string',
            description: 'Optional Figma team ID for project operations',
          },
          projectId: {
            type: 'string',
            description: 'Optional default Figma project ID',
          },
        },
        required: ['personalAccessToken'],
      },
    },
    {
      name: 'repoframe_figma_whoami',
      description: 'Check currently authenticated Figma user and credential status.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'repoframe_figma_logout',
      description: 'Remove stored Figma credentials from the local repository.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'repoframe_figma_list_projects',
      description: 'List Figma projects in a team.',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: {
            type: 'string',
            description: 'Figma team ID. Uses stored team ID if not provided.',
          },
        },
      },
    },
    {
      name: 'repoframe_figma_list_files',
      description: 'List files in a Figma project.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Figma project ID. Uses stored project ID if not provided.',
          },
        },
      },
    },
    {
      name: 'repoframe_figma_push_wireframe',
      description: 'Push a RepoFrame wireframe export to Figma. Generates plugin commands from the wireframe JSON artifact and optionally posts them as a comment on a Figma file for the plugin to pick up.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'RepoFrame job ID to export',
          },
          route: {
            type: 'string',
            description: 'Route path (e.g., "/", "/about"). Defaults to "/".',
          },
          fidelity: {
            type: 'string',
            enum: ['lowfi', 'highfi'],
            description: 'Wireframe fidelity. Defaults to "lowfi".',
          },
          fileKey: {
            type: 'string',
            description: 'Figma file key to push to (from URL: figma.com/file/{key}/...)',
          },
        },
        required: ['jobId'],
      },
    },
    {
      name: 'repoframe_figma_get_wireframe_payload',
      description: 'Get the Figma-compatible wireframe payload for a job without pushing to Figma. Useful for inspection or manual import.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'RepoFrame job ID',
          },
          route: {
            type: 'string',
            description: 'Route path. Defaults to "/".',
          },
          fidelity: {
            type: 'string',
            enum: ['lowfi', 'highfi'],
            description: 'Wireframe fidelity. Defaults to "lowfi".',
          },
        },
        required: ['jobId'],
      },
    },
    {
      name: 'repoframe_figma_export_screenshot',
      description: 'Get screenshot images from a Figma file for comparison with wireframe.',
      inputSchema: {
        type: 'object',
        properties: {
          fileKey: {
            type: 'string',
            description: 'Figma file key',
          },
          nodeIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Node IDs to export as images',
          },
          format: {
            type: 'string',
            enum: ['png', 'svg', 'jpg', 'pdf'],
            description: 'Image format. Defaults to "png".',
          },
        },
        required: ['fileKey', 'nodeIds'],
      },
    },
    {
      name: 'repoframe_list_jobs',
      description: 'List all RepoFrame wireframe jobs with their status and available artifacts.',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'repoframe_figma_login': {
        const { personalAccessToken, teamId, projectId } = args as any;
        const creds = await loadCredentials();
        creds.figma = {
          personalAccessToken,
          ...(teamId && { teamId }),
          ...(projectId && { projectId }),
        };
        const savedPath = await saveCredentials(creds);

        // Verify the token works
        try {
          const me = await getMe();
          return {
            content: [{
              type: 'text',
              text: `Successfully authenticated as ${me.handle} (${me.email}).\nCredentials saved to: ${savedPath}\n\nNote: This file is chmod 600 and should be added to .gitignore.`,
            }],
          };
        } catch (err: any) {
          // Save anyway but warn
          return {
            content: [{
              type: 'text',
              text: `Credentials saved to ${savedPath}, but verification failed: ${err.message}\nPlease check your token is valid.`,
            }],
          };
        }
      }

      case 'repoframe_figma_whoami': {
        const token = await getFigmaToken();
        if (!token) {
          return {
            content: [{
              type: 'text',
              text: 'Not authenticated. No Figma token found.\n\nSet up with: repoframe_figma_login tool or FIGMA_PERSONAL_ACCESS_TOKEN env var.',
            }],
          };
        }
        const me = await getMe();
        const creds = await loadCredentials();
        return {
          content: [{
            type: 'text',
            text: `Authenticated as: ${me.handle} (${me.email})\nUser ID: ${me.id}\nTeam ID: ${creds.figma?.teamId || 'not set'}\nProject ID: ${creds.figma?.projectId || 'not set'}`,
          }],
        };
      }

      case 'repoframe_figma_logout': {
        await clearCredentials();
        return {
          content: [{
            type: 'text',
            text: 'Figma credentials removed.',
          }],
        };
      }

      case 'repoframe_figma_list_projects': {
        const creds = await loadCredentials();
        const teamId = (args as any).teamId || creds.figma?.teamId;
        if (!teamId) {
          return {
            content: [{
              type: 'text',
              text: 'No team ID provided. Pass teamId parameter or store it via repoframe_figma_login.',
            }],
          };
        }
        const projects = await getTeamProjects(teamId);
        const list = projects.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');
        return {
          content: [{
            type: 'text',
            text: `Projects in team ${teamId}:\n${list || 'No projects found.'}`,
          }],
        };
      }

      case 'repoframe_figma_list_files': {
        const creds = await loadCredentials();
        const projectId = (args as any).projectId || creds.figma?.projectId;
        if (!projectId) {
          return {
            content: [{
              type: 'text',
              text: 'No project ID provided. Pass projectId parameter or store it via repoframe_figma_login.',
            }],
          };
        }
        const files = await getProjectFiles(projectId);
        const list = files.map(f => `- ${f.name} (key: ${f.key}, modified: ${f.lastModified})`).join('\n');
        return {
          content: [{
            type: 'text',
            text: `Files in project ${projectId}:\n${list || 'No files found.'}`,
          }],
        };
      }

      case 'repoframe_figma_push_wireframe': {
        const { jobId, route = '/', fidelity = 'lowfi', fileKey } = args as any;
        const payload = await loadWireframePayload(jobId, route, fidelity);

        if (!payload) {
          return {
            content: [{
              type: 'text',
              text: `No figma export found for job ${jobId}, route "${route}", fidelity "${fidelity}".\nCheck that the job completed successfully and artifacts were generated.`,
            }],
          };
        }

        const pluginCommands = generatePluginCommands(payload);

        if (fileKey) {
          // Post as comment with structured data for plugin pickup
          const commandPayload = JSON.stringify({
            type: 'repoframe-import',
            version: '1.0',
            commands: pluginCommands,
          });

          await postComment(fileKey, `[RepoFrame Import]\n\`\`\`json\n${commandPayload}\n\`\`\``);

          return {
            content: [{
              type: 'text',
              text: `Wireframe pushed to Figma file ${fileKey}.\n\nPosted ${pluginCommands.length} commands as a comment.\nOpen the file in Figma and run the RepoFrame plugin to apply.\n\nRoute: ${route}\nFidelity: ${fidelity}\nComponents: ${Object.keys(payload.components || {}).length}`,
            }],
          };
        }

        // Return commands without pushing
        return {
          content: [{
            type: 'text',
            text: `Generated ${pluginCommands.length} Figma plugin commands for job ${jobId}.\n\nTo push to Figma, provide a fileKey parameter.\n\n${JSON.stringify(pluginCommands.slice(0, 3), null, 2)}${pluginCommands.length > 3 ? `\n... and ${pluginCommands.length - 3} more commands` : ''}`,
          }],
        };
      }

      case 'repoframe_figma_get_wireframe_payload': {
        const { jobId, route = '/', fidelity = 'lowfi' } = args as any;
        const payload = await loadWireframePayload(jobId, route, fidelity);

        if (!payload) {
          return {
            content: [{
              type: 'text',
              text: `No figma export found for job ${jobId}, route "${route}", fidelity "${fidelity}".`,
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(payload, null, 2),
          }],
        };
      }

      case 'repoframe_figma_export_screenshot': {
        const { fileKey, nodeIds, format = 'png' } = args as any;
        const images = await getImages(fileKey, nodeIds, format);
        const list = Object.entries(images)
          .map(([id, url]) => `- Node ${id}: ${url}`)
          .join('\n');
        return {
          content: [{
            type: 'text',
            text: `Exported ${Object.keys(images).length} images:\n${list}`,
          }],
        };
      }

      case 'repoframe_list_jobs': {
        const jobs = await listLocalJobs();
        if (jobs.length === 0) {
          return {
            content: [{
              type: 'text',
              text: 'No RepoFrame jobs found. Create a job via the web UI or API first.',
            }],
          };
        }
        const list = jobs.map(j =>
          `- [${j.status}] ${j.id}\n  Source: ${j.input?.source || 'unknown'} | ${j.input?.githubUrl || j.input?.zipFileName || ''}\n  Artifacts: ${(j.artifacts || []).length}`
        ).join('\n');
        return {
          content: [{
            type: 'text',
            text: `RepoFrame Jobs (${jobs.length}):\n${list}`,
          }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ─── Resources ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'repoframe://credentials/status',
      name: 'Credential Status',
      description: 'Current authentication status for Figma',
      mimeType: 'application/json',
    },
    {
      uri: 'repoframe://jobs',
      name: 'Job List',
      description: 'All RepoFrame wireframe jobs',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'repoframe://credentials/status') {
    const token = await getFigmaToken();
    const creds = await loadCredentials();
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          authenticated: !!token,
          teamId: creds.figma?.teamId || null,
          projectId: creds.figma?.projectId || null,
          tokenSource: process.env.FIGMA_PERSONAL_ACCESS_TOKEN ? 'env' : token ? 'file' : 'none',
        }, null, 2),
      }],
    };
  }

  if (uri === 'repoframe://jobs') {
    const jobs = await listLocalJobs();
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(jobs, null, 2),
      }],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadWireframePayload(jobId: string, route: string, fidelity: string): Promise<any | null> {
  const artifactsDir = path.resolve(
    process.env.ARTIFACTS_DIR || path.join(REPOFRAME_ROOT, 'data/artifacts'),
    jobId
  );

  const sanitizedRoute = route.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'index';
  const filename = `figma-export-${fidelity}-${sanitizedRoute}.json`;

  try {
    const content = await fs.readFile(path.join(artifactsDir, filename), 'utf-8');
    return JSON.parse(content);
  } catch {
    // Try alternative naming patterns
    try {
      const files = await fs.readdir(artifactsDir);
      const match = files.find(f =>
        f.startsWith('figma-export') &&
        f.includes(fidelity) &&
        f.includes(sanitizedRoute)
      );
      if (match) {
        const content = await fs.readFile(path.join(artifactsDir, match), 'utf-8');
        return JSON.parse(content);
      }
    } catch {}
    return null;
  }
}

async function listLocalJobs(): Promise<any[]> {
  const jobsDir = path.resolve(
    process.env.JOBS_DIR || path.join(REPOFRAME_ROOT, 'data/jobs')
  );

  try {
    const files = await fs.readdir(jobsDir);
    const jobs: any[] = [];
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await fs.readFile(path.join(jobsDir, file), 'utf-8');
        jobs.push(JSON.parse(content));
      } catch {}
    }
    return jobs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('RepoFrame Figma MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
