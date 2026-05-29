import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useJob, useRetryStage } from '../hooks/useJobs';
import { apiPost } from '../lib/api';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Clock,
  ArrowRight, Eye, Download, Bug, RotateCcw, Upload,
} from 'lucide-react';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading, error } = useJob(id);
  const retryStage = useRetryStage();
  const navigate = useNavigate();
  const [figmaSyncing, setFigmaSyncing] = useState(false);
  const [figmaResult, setFigmaResult] = useState<string | null>(null);

  async function handleFigmaSync() {
    if (!id) return;
    setFigmaSyncing(true);
    setFigmaResult(null);
    try {
      const result = await apiPost<{ success: boolean; figmaFileUrl: string }>('/figma/sync', { jobId: id });
      setFigmaResult(result.figmaFileUrl);
    } catch (err: any) {
      setFigmaResult(`Error: ${err.message}`);
    }
    setFigmaSyncing(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="card p-8 text-center">
        <XCircle className="w-10 h-10 mx-auto text-[var(--color-error)] mb-3" />
        <p className="text-sm">Job not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            Job Details
            <StatusBadge status={job.status} />
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {job.input.githubUrl || job.input.zipFileName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {job.routes.length > 0 && (
            <button onClick={() => navigate(`/jobs/${id}/routes`)} className="btn-secondary text-xs">
              <Eye className="w-3.5 h-3.5" /> Routes
            </button>
          )}
          {job.artifacts.length > 0 && (
            <button onClick={() => navigate(`/jobs/${id}/export`)} className="btn-secondary text-xs">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
          {job.status === 'completed' && (
            <button onClick={handleFigmaSync} disabled={figmaSyncing} className="btn-secondary text-xs">
              {figmaSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {figmaSyncing ? 'Syncing...' : 'Sync to Figma'}
            </button>
          )}
          {job.errorSummary && (
            <button onClick={() => navigate(`/jobs/${id}/errors`)} className="btn-secondary text-xs">
              <Bug className="w-3.5 h-3.5" /> Errors
            </button>
          )}
        </div>
      </div>

      {/* Figma sync result */}
      {figmaResult && (
        <div className={`p-3 rounded-lg text-xs ${figmaResult.startsWith('Error') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>
          {figmaResult.startsWith('Error') ? figmaResult : (
            <span>Synced to Figma! <a href={figmaResult} target="_blank" rel="noreferrer" className="underline font-medium">Open in Figma →</a></span>
          )}
        </div>
      )}

      {/* Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard label="Source" value={job.input.source} />
        <InfoCard label="Framework" value={job.workspace?.framework || '—'} />
        <InfoCard label="Routes" value={String(job.routes.length)} />
        <InfoCard label="Artifacts" value={String(job.artifacts.length)} />
      </div>

      {/* Pipeline stages */}
      <div className="card">
        <h2 className="text-sm font-medium mb-4">Pipeline Progress</h2>
        <div className="space-y-2">
          {job.stages.map((stage, i) => (
            <div key={stage.name} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[var(--color-bg-secondary)]">
              <StageIcon status={stage.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">{stage.name}</span>
                  {stage.durationMs && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {(stage.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {stage.error && (
                  <p className="text-xs text-[var(--color-error)] mt-0.5 truncate">{stage.error}</p>
                )}
                {stage.warnings.length > 0 && (
                  <p className="text-xs text-[var(--color-warning)] mt-0.5">
                    {stage.warnings.length} warning{stage.warnings.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              {stage.status === 'failed' && (
                <button
                  className="btn-ghost text-xs text-brand-600"
                  onClick={() => retryStage.mutate({ jobId: job.id, stage: stage.name })}
                  disabled={retryStage.isPending}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      {job.status === 'completed' && (
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/jobs/${id}/wireframe`)}
            className="btn-primary flex-1"
          >
            View Wireframes <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(`/jobs/${id}/export`)}
            className="btn-secondary flex-1"
          >
            Export Center <Download className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-xs text-[var(--color-text-tertiary)]">{label}</p>
      <p className="text-sm font-medium mt-0.5 capitalize">{value}</p>
    </div>
  );
}

function StageIcon({ status }: { status: string }) {
  switch (status) {
    case 'success': return <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />;
    case 'failed': return <XCircle className="w-4 h-4 text-[var(--color-error)]" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" />;
    case 'running': return <Loader2 className="w-4 h-4 animate-spin text-brand-500" />;
    case 'skipped': return <Clock className="w-4 h-4 text-[var(--color-text-tertiary)]" />;
    default: return <div className="w-4 h-4 rounded-full border-2 border-[var(--color-border)]" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    completed: 'badge-success',
    failed: 'badge-error',
    pending: 'badge-neutral',
    cancelled: 'badge-neutral',
  };
  return <span className={`badge ${classes[status] || 'badge-info'}`}>{status}</span>;
}
