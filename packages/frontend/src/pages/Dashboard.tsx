import { useNavigate } from 'react-router-dom';
import { useJobs, useDeleteJob } from '../hooks/useJobs';
import { Clock, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';

export function DashboardPage() {
  const { data: jobs, isLoading, error } = useJobs();
  const deleteJob = useDeleteJob();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <XCircle className="w-10 h-10 mx-auto text-[var(--color-error)] mb-3" />
        <p className="text-sm text-[var(--color-text-secondary)]">Failed to load jobs</p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6 text-[var(--color-text-tertiary)]" />
          </div>
          <h2 className="font-medium">No jobs yet</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Create your first job to generate wireframes from a codebase.
          </p>
          <button onClick={() => navigate('/jobs/new')} className="btn-primary mt-2">
            Create Job
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <span className="text-sm text-[var(--color-text-secondary)]">{jobs.length} jobs</span>
      </div>

      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="card flex items-center gap-4 cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
            onClick={() => navigate(`/jobs/${job.id}`)}
          >
            <StatusIcon status={job.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {job.input.githubUrl || job.input.zipFileName || 'Unknown'}
                </span>
                <StatusBadge status={job.status} />
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {job.input.source === 'github' ? 'GitHub' : 'ZIP'}
                </span>
                {job.workspace?.framework && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {job.workspace.framework}
                  </span>
                )}
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <button
              className="btn-ghost text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this job?')) deleteJob.mutate(job.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" />;
  if (status === 'failed') return <XCircle className="w-5 h-5 text-[var(--color-error)]" />;
  if (['pending', 'cancelled'].includes(status)) return <Clock className="w-5 h-5 text-[var(--color-text-tertiary)]" />;
  return <Loader2 className="w-5 h-5 animate-spin text-brand-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    completed: 'badge-success',
    failed: 'badge-error',
    pending: 'badge-neutral',
    cancelled: 'badge-neutral',
  };
  const badgeClass = classes[status] || 'badge-info';
  return <span className={`badge ${badgeClass}`}>{status}</span>;
}
