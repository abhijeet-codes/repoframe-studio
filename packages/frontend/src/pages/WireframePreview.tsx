import { useParams, useSearchParams } from 'react-router-dom';
import { useJob, useJobArtifacts } from '../hooks/useJobs';
import { useState } from 'react';
import { Loader2, Columns, Maximize2 } from 'lucide-react';

export function WireframePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const selectedRoute = searchParams.get('route') || '/';
  const { data: job, isLoading } = useJob(id);
  const { data: artifacts } = useJobArtifacts(id);
  const [fidelity, setFidelity] = useState<'low-fi' | 'high-fi'>('low-fi');
  const [viewMode, setViewMode] = useState<'split' | 'full'>('split');

  if (isLoading || !job) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const routeSlug = selectedRoute.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'index';
  const screenshotFile = `screenshot-${routeSlug}.png`;
  const wireframeSvg = fidelity === 'low-fi' ? `lowfi-${routeSlug}.svg` : `highfi-${routeSlug}.svg`;

  const hasScreenshot = artifacts?.some(a => a.filename === screenshotFile);
  const hasWireframe = artifacts?.some(a => a.filename === wireframeSvg);

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Wireframe Preview</h1>
          <span className="text-sm text-[var(--color-text-secondary)] font-mono">{selectedRoute}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Fidelity toggle */}
          <div className="flex border border-[var(--color-border)] rounded-lg overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                fidelity === 'low-fi' ? 'bg-brand-600 text-white' : 'hover:bg-[var(--color-bg-tertiary)]'
              }`}
              onClick={() => setFidelity('low-fi')}
            >
              Low-fi
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                fidelity === 'high-fi' ? 'bg-brand-600 text-white' : 'hover:bg-[var(--color-bg-tertiary)]'
              }`}
              onClick={() => setFidelity('high-fi')}
            >
              High-fi
            </button>
          </div>
          {/* View mode */}
          <button
            className="btn-ghost"
            onClick={() => setViewMode(v => v === 'split' ? 'full' : 'split')}
          >
            {viewMode === 'split' ? <Maximize2 className="w-4 h-4" /> : <Columns className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Route selector */}
      {job.routes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {job.routes.map(route => {
            const isActive = route === selectedRoute;
            return (
              <a
                key={route}
                href={`/jobs/${id}/wireframe?route=${encodeURIComponent(route)}`}
                className={`px-3 py-1 text-xs font-mono rounded-full whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                {route}
              </a>
            );
          })}
        </div>
      )}

      {/* Preview area */}
      <div className={`flex-1 min-h-0 ${viewMode === 'split' ? 'grid grid-cols-2 gap-4' : ''}`}>
        {/* Original screenshot */}
        {viewMode === 'split' && (
          <div className="card overflow-hidden flex flex-col">
            <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Original</div>
            <div className="flex-1 overflow-auto bg-[var(--color-bg-tertiary)] rounded-lg">
              {hasScreenshot ? (
                <img
                  src={`/api/artifacts/${id}/${screenshotFile}`}
                  alt="Original screenshot"
                  className="w-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)] text-sm">
                  No screenshot available
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wireframe */}
        <div className="card overflow-hidden flex flex-col">
          <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
            Wireframe ({fidelity})
          </div>
          <div className="flex-1 overflow-auto bg-[var(--color-bg-tertiary)] rounded-lg">
            {hasWireframe ? (
              <img
                src={`/api/artifacts/${id}/${wireframeSvg}`}
                alt={`${fidelity} wireframe`}
                className="w-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)] text-sm">
                No wireframe generated
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
