import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateJob, useUploadZip } from '../hooks/useJobs';
import { useDropzone } from 'react-dropzone';
import { Github, Upload, FileArchive, Loader2, AlertCircle } from 'lucide-react';

type Tab = 'github' | 'zip';

export function NewJobPage() {
  const [tab, setTab] = useState<Tab>('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [startCommand, setStartCommand] = useState('');
  const [routeHints, setRouteHints] = useState('');
  const [mode, setMode] = useState<'both' | 'low-fi' | 'high-fi'>('both');
  const [zipFile, setZipFile] = useState<File | null>(null);

  const createJob = useCreateJob();
  const uploadZip = useUploadZip();
  const navigate = useNavigate();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/zip': ['.zip'] },
    maxFiles: 1,
    onDrop: (files) => {
      if (files[0]) setZipFile(files[0]);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (tab === 'github') {
        const job = await createJob.mutateAsync({
          source: 'github',
          githubUrl,
          branch: branch || undefined,
          rootPath: rootPath || undefined,
          startCommand: startCommand || undefined,
          routeHints: routeHints ? routeHints.split(',').map(r => r.trim()) : undefined,
          mode,
        });
        navigate(`/jobs/${job.id}`);
      } else {
        if (!zipFile) return;
        const params: Record<string, string> = { mode };
        if (rootPath) params.rootPath = rootPath;
        if (startCommand) params.startCommand = startCommand;
        if (routeHints) params.routeHints = routeHints;
        const job = await uploadZip.mutateAsync({ file: zipFile, params });
        navigate(`/jobs/${job.id}`);
      }
    } catch {
      // error handled by mutation state
    }
  };

  const isLoading = createJob.isPending || uploadZip.isPending;
  const error = createJob.error || uploadZip.error;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">New Job</h1>

      {/* Tab selector */}
      <div className="flex border border-[var(--color-border)] rounded-lg overflow-hidden">
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            tab === 'github' ? 'bg-brand-600 text-white' : 'hover:bg-[var(--color-bg-tertiary)]'
          }`}
          onClick={() => setTab('github')}
        >
          <Github className="w-4 h-4" />
          GitHub URL
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            tab === 'zip' ? 'bg-brand-600 text-white' : 'hover:bg-[var(--color-bg-tertiary)]'
          }`}
          onClick={() => setTab('zip')}
        >
          <FileArchive className="w-4 h-4" />
          ZIP Upload
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Source-specific fields */}
        {tab === 'github' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Repository URL</label>
              <input
                type="url"
                className="input-field"
                placeholder="https://github.com/user/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Branch (optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">ZIP File</label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10'
                  : 'border-[var(--color-border)] hover:border-brand-300'
              }`}
            >
              <input {...getInputProps()} />
              {zipFile ? (
                <div className="space-y-2">
                  <FileArchive className="w-8 h-8 mx-auto text-brand-500" />
                  <p className="text-sm font-medium">{zipFile.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {(zipFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-[var(--color-text-tertiary)]" />
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Drop your ZIP file here or click to browse
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">Max 100 MB</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Common options */}
        <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Options</h3>

          <div>
            <label className="block text-sm font-medium mb-1">Root Path (optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., packages/frontend"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Start Command (optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., dev"
              value={startCommand}
              onChange={(e) => setStartCommand(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Route Hints (optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="/, /about, /dashboard"
              value={routeHints}
              onChange={(e) => setRouteHints(e.target.value)}
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Comma-separated routes to render</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Wireframe Mode</label>
            <select
              className="input-field"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="both">Both (Low-fi + High-fi)</option>
              <option value="low-fi">Low-fidelity only</option>
              <option value="high-fi">High-fidelity only</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-[var(--color-error)] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--color-error)]">{(error as Error).message}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={isLoading || (tab === 'github' && !githubUrl) || (tab === 'zip' && !zipFile)}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Start Job'
          )}
        </button>
      </form>
    </div>
  );
}
