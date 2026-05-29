import { useParams, useNavigate } from 'react-router-dom';
import { useJob, useJobArtifacts } from '../hooks/useJobs';
import { Loader2, Image, ArrowRight } from 'lucide-react';

export function RouteExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading } = useJob(id);
  const { data: artifacts } = useJobArtifacts(id);
  const navigate = useNavigate();

  if (isLoading || !job) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (job.routes.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">No routes discovered for this job.</p>
      </div>
    );
  }

  const screenshots = (artifacts || []).filter(a => a.filename.startsWith('screenshot-'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Route Explorer</h1>
        <span className="text-sm text-[var(--color-text-secondary)]">{job.routes.length} routes</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {job.routes.map((route) => {
          const routeSlug = route.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'index';
          const screenshot = screenshots.find(s => s.filename.includes(routeSlug));

          return (
            <div key={route} className="card overflow-hidden hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
              {/* Thumbnail */}
              <div className="aspect-video bg-[var(--color-bg-tertiary)] flex items-center justify-center -m-4 mb-3 rounded-t-xl overflow-hidden">
                {screenshot ? (
                  <img
                    src={`/api/artifacts/${id}/${screenshot.filename}`}
                    alt={`Screenshot of ${route}`}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <Image className="w-8 h-8 text-[var(--color-text-tertiary)]" />
                )}
              </div>

              <div className="pt-2">
                <p className="text-sm font-medium font-mono">{route}</p>
                <button
                  onClick={() => navigate(`/jobs/${id}/wireframe?route=${encodeURIComponent(route)}`)}
                  className="btn-ghost text-xs mt-2 text-brand-600"
                >
                  View Wireframe <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
