import { useState, useEffect } from 'react';
import { Figma, Info, ExternalLink, CheckCircle, XCircle, LogIn, LogOut, Copy, Loader2 } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../lib/api';

interface FigmaStatus {
  authenticated: boolean;
  tokenPreview: string | null;
  teamId: string | null;
  projectId: string | null;
}

interface FigmaUser {
  handle: string;
  email: string;
  id: string;
}

export function FigmaSyncPage() {
  const [status, setStatus] = useState<FigmaStatus | null>(null);
  const [user, setUser] = useState<FigmaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ token: '', teamId: '', projectId: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const s = await apiGet<FigmaStatus>('/figma/status');
      setStatus(s);
      if (s.authenticated) {
        try {
          const u = await apiGet<FigmaUser>('/figma/me');
          setUser(u);
        } catch {}
      }
    } catch {
      setStatus({ authenticated: false, tokenPreview: null, teamId: null, projectId: null });
    }
    setLoading(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await apiPost<{ success: boolean; user: FigmaUser; storedAt: string }>('/figma/login', {
        personalAccessToken: loginForm.token,
        ...(loginForm.teamId && { teamId: loginForm.teamId }),
        ...(loginForm.projectId && { projectId: loginForm.projectId }),
      });
      setUser(res.user);
      setLoginForm({ token: '', teamId: '', projectId: '' });
      await loadStatus();
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
    setLoginLoading(false);
  }

  async function handleLogout() {
    await apiDelete('/figma/logout');
    setStatus({ authenticated: false, tokenPreview: null, teamId: null, projectId: null });
    setUser(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Figma Integration</h1>

      {/* Auth Status */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <Figma className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-medium">Figma Connection</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {status?.authenticated ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
          {status?.authenticated ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
        </div>

        {status?.authenticated && user && (
          <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] space-y-1">
            <p className="text-xs"><span className="text-[var(--color-text-secondary)]">User:</span> {user.handle}</p>
            <p className="text-xs"><span className="text-[var(--color-text-secondary)]">Email:</span> {user.email}</p>
            <p className="text-xs"><span className="text-[var(--color-text-secondary)]">Token:</span> {status.tokenPreview}</p>
            {status.teamId && <p className="text-xs"><span className="text-[var(--color-text-secondary)]">Team:</span> {status.teamId}</p>}
            {status.projectId && <p className="text-xs"><span className="text-[var(--color-text-secondary)]">Project:</span> {status.projectId}</p>}
            <button onClick={handleLogout} className="mt-2 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600">
              <LogOut className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        )}

        {!status?.authenticated && (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Personal Access Token</label>
              <input
                type="password"
                value={loginForm.token}
                onChange={e => setLoginForm(f => ({ ...f, token: e.target.value }))}
                placeholder="figd_..."
                className="input-field mt-1"
                required
              />
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                Generate at{' '}
                <a href="https://www.figma.com/developers/api#access-tokens" target="_blank" rel="noreferrer" className="underline">
                  Figma Settings → Personal Access Tokens
                </a>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Team ID (optional)</label>
                <input
                  type="text"
                  value={loginForm.teamId}
                  onChange={e => setLoginForm(f => ({ ...f, teamId: e.target.value }))}
                  placeholder="1234567890"
                  className="input-field mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Project ID (optional)</label>
                <input
                  type="text"
                  value={loginForm.projectId}
                  onChange={e => setLoginForm(f => ({ ...f, projectId: e.target.value }))}
                  placeholder="9876543210"
                  className="input-field mt-1"
                />
              </div>
            </div>
            {loginError && (
              <p className="text-xs text-red-500">{loginError}</p>
            )}
            <button type="submit" disabled={loginLoading} className="btn-primary flex items-center gap-2">
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Connect to Figma
            </button>
          </form>
        )}
      </div>

      {/* MCP Integration */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium">MCP Integration (AI Assistant)</h2>
        <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[var(--color-info)] mt-0.5 shrink-0" />
            <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
              <p>RepoFrame includes an MCP server for AI-assisted Figma export.</p>
              <p>Add to your VS Code <code className="font-mono bg-[var(--color-bg-primary)] px-1 rounded">.vscode/mcp.json</code> or Claude Desktop config:</p>
            </div>
          </div>
        </div>
        <div className="relative">
          <pre className="text-xs font-mono p-3 rounded-lg bg-[var(--color-bg-secondary)] overflow-x-auto">
{`{
  "mcpServers": {
    "repoframe-figma": {
      "command": "node",
      "args": ["packages/figma-mcp/dist/index.js"],
      "env": {
        "REPOFRAME_PROJECT_ROOT": "."
      }
    }
  }
}`}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify({ mcpServers: { "repoframe-figma": { command: "node", args: ["packages/figma-mcp/dist/index.js"], env: { REPOFRAME_PROJECT_ROOT: "." } } } }, null, 2))}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
            title="Copy"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Available tools: <code className="font-mono">repoframe_figma_login</code>, <code className="font-mono">repoframe_figma_push_wireframe</code>, <code className="font-mono">repoframe_list_jobs</code>, and more.
        </p>
      </div>

      {/* Credential Storage Info */}
      <div className="card space-y-3">
        <h2 className="text-sm font-medium">Credential Storage</h2>
        <div className="text-xs text-[var(--color-text-secondary)] space-y-2">
          <p>Credentials are stored locally at:</p>
          <code className="block font-mono p-2 rounded bg-[var(--color-bg-secondary)]">.repoframe/credentials.json</code>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Stored only on your machine (chmod 600)</li>
            <li>Added to .gitignore — never committed</li>
            <li>Used by both the backend API and MCP server</li>
            <li>Can also use <code className="font-mono">FIGMA_PERSONAL_ACCESS_TOKEN</code> env var</li>
          </ul>
        </div>
      </div>

      {/* Export Format */}
      <div className="card space-y-3">
        <h2 className="text-sm font-medium">Figma Export Format</h2>
        <pre className="text-xs font-mono p-3 rounded-lg bg-[var(--color-bg-secondary)] overflow-x-auto">
{`{
  "version": "1.0",
  "jobId": "uuid",
  "route": "/",
  "document": {
    "name": "RepoFrame - /",
    "children": [
      {
        "type": "FRAME",
        "name": "Root",
        "layoutMode": "VERTICAL",
        "children": [...]
      }
    ]
  },
  "components": {
    "button-Submit": { ... },
    "card-default": { ... }
  }
}`}
        </pre>
      </div>
    </div>
  );
}
