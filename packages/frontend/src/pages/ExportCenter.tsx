import { useParams } from 'react-router-dom';
import { useJobArtifacts } from '../hooks/useJobs';
import { Loader2, Download, FileJson, Image, FileText, FileCode } from 'lucide-react';

export function ExportCenterPage() {
  const { id } = useParams<{ id: string }>();
  const { data: artifacts, isLoading } = useJobArtifacts(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">No artifacts generated yet.</p>
      </div>
    );
  }

  const grouped = groupArtifacts(artifacts);

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-semibold">Export Center</h1>

      {Object.entries(grouped).map(([category, files]) => (
        <div key={category} className="card">
          <h2 className="text-sm font-medium mb-3 capitalize">{category}</h2>
          <div className="space-y-1">
            {files.map((artifact) => (
              <div key={artifact.filename} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[var(--color-bg-secondary)]">
                <FileIcon filename={artifact.filename} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono truncate">{artifact.filename}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {formatBytes(artifact.sizeBytes)}
                  </p>
                </div>
                <a
                  href={`/api/artifacts/${id}/${artifact.filename}`}
                  download={artifact.filename}
                  className="btn-ghost text-xs text-brand-600"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Download all */}
      <button
        className="btn-primary w-full"
        onClick={() => {
          artifacts.forEach(a => {
            const link = document.createElement('a');
            link.href = `/api/artifacts/${id}/${a.filename}`;
            link.download = a.filename;
            link.click();
          });
        }}
      >
        <Download className="w-4 h-4" />
        Download All ({artifacts.length} files)
      </button>
    </div>
  );
}

function groupArtifacts(artifacts: Array<{ filename: string; sizeBytes: number; createdAt: string }>) {
  const groups: Record<string, typeof artifacts> = {
    wireframes: [],
    screenshots: [],
    figma: [],
    previews: [],
    logs: [],
  };

  for (const artifact of artifacts) {
    if (artifact.filename.startsWith('wireframe-') || artifact.filename.endsWith('.svg')) {
      groups.wireframes.push(artifact);
    } else if (artifact.filename.startsWith('screenshot-')) {
      groups.screenshots.push(artifact);
    } else if (artifact.filename.startsWith('figma-')) {
      groups.figma.push(artifact);
    } else if (artifact.filename.startsWith('preview-')) {
      groups.previews.push(artifact);
    } else {
      groups.logs.push(artifact);
    }
  }

  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 0));
}

function FileIcon({ filename }: { filename: string }) {
  if (filename.endsWith('.json')) return <FileJson className="w-4 h-4 text-yellow-500" />;
  if (filename.endsWith('.png')) return <Image className="w-4 h-4 text-purple-500" />;
  if (filename.endsWith('.svg')) return <FileCode className="w-4 h-4 text-green-500" />;
  if (filename.endsWith('.html')) return <FileCode className="w-4 h-4 text-orange-500" />;
  return <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
