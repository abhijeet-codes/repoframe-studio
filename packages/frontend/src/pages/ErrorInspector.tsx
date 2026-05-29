import { useParams } from 'react-router-dom';
import { useJob, useJobLogs, useRetryStage } from '../hooks/useJobs';
import { useState } from 'react';
import { Loader2, AlertCircle, ChevronDown, ChevronRight, RotateCcw, Copy, Check } from 'lucide-react';

export function ErrorInspectorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading } = useJob(id);
  const { data: logs } = useJobLogs(id);
  const retryStage = useRetryStage();
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (isLoading || !job) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const failedStages = job.stages.filter(s => s.status === 'failed');
  const warningStages = job.stages.filter(s => s.status === 'warning');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-semibold">Error Inspector</h1>

      {/* Error summary */}
      {job.errorSummary && (
        <div className="card border-[var(--color-error)]/30 bg-red-50/50 dark:bg-red-900/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--color-error)] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-medium text-[var(--color-error)]">Job Failed</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">{job.errorSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Failed stages */}
      {failedStages.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-sm font-medium text-[var(--color-error)]">
            Failed Stages ({failedStages.length})
          </h2>
          {failedStages.map(stage => (
            <div key={stage.name} className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium capitalize">{stage.name}</p>
                  <p className="text-xs text-[var(--color-error)] mt-0.5">{stage.error}</p>
                </div>
                <button
                  className="btn-ghost text-xs text-brand-600"
                  onClick={() => retryStage.mutate({ jobId: job.id, stage: stage.name })}
                  disabled={retryStage.isPending}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
              {stage.durationMs && (
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  Duration: {(stage.durationMs / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Warning stages */}
      {warningStages.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-sm font-medium text-[var(--color-warning)]">
            Warnings ({warningStages.length})
          </h2>
          {warningStages.map(stage => (
            <div key={stage.name} className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-medium capitalize">{stage.name}</p>
              {stage.warnings.map((w, i) => (
                <p key={i} className="text-xs text-[var(--color-warning)] mt-0.5">{w}</p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Logs */}
      {logs && Object.keys(logs).length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-sm font-medium">Logs</h2>
          {Object.entries(logs).map(([name, content]) => (
            <div key={name} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-2 p-3 text-sm font-mono hover:bg-[var(--color-bg-secondary)] transition-colors"
                onClick={() => setExpandedLog(expandedLog === name ? null : name)}
              >
                {expandedLog === name ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                {name}
                <span className="text-xs text-[var(--color-text-tertiary)] ml-auto">
                  {content.split('\n').length} lines
                </span>
              </button>
              {expandedLog === name && (
                <div className="relative">
                  <button
                    className="absolute top-2 right-2 btn-ghost text-xs"
                    onClick={() => copyToClipboard(content, name)}
                  >
                    {copied === name ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <pre className="p-3 text-xs font-mono overflow-x-auto max-h-80 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
                    {content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {failedStages.length === 0 && warningStages.length === 0 && !job.errorSummary && (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No errors or warnings for this job.</p>
        </div>
      )}
    </div>
  );
}
